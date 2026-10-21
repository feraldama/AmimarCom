const WesternEnvio = require("../models/westernenvio.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");
const { esGrupoWestern, revertirWestern } = require("../utils/ajusteCajas");
const { aplicarEnTurno, motivoEliminacion } = require("../utils/correccionTurno");
const db = require("../config/db");

// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  tipoGastoGrupoId: query.tipoGastoGrupoId || undefined,
});

// Obtener todos los envíos western con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "WesternEnvioId";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await WesternEnvio.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener envíos western:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar envíos western
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "WesternEnvioId";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await WesternEnvio.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de envíos western:", error);
    res.status(500).json({ error: "Error al buscar envíos western" });
  }
};

// Obtener un envío western por ID
exports.getById = async (req, res) => {
  try {
    const envio = await WesternEnvio.getById(req.params.id);
    if (!envio) {
      return res.status(404).json({ message: "Envío western no encontrado" });
    }
    res.json(envio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo envío western
exports.create = async (req, res) => {
  try {
    await RegistroDiarioCaja.validarFechaEnTurno(req.body.CajaId, req.body.WesternEnvioFecha);
    const envio = await WesternEnvio.create({
      ...req.body,
      UsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Envío western creado exitosamente",
      data: envio,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Busca y bloquea el registro de caja de un envío/pago Western. El par se
// identifica por los campos que comparten al crearse (ver findByWesternEnvio).
const registroDelEnvio = async (client, envio) => {
  const registro = await RegistroDiarioCaja.findByWesternEnvio(
    envio.CajaId,
    envio.TipoGastoId,
    envio.TipoGastoGrupoId,
    envio.WesternEnvioFecha,
    envio.WesternEnvioMonto,
    client
  );
  if (!registro) return null;
  return (
    await client.query(
      `SELECT * FROM "registrodiariocaja" WHERE "RegistroDiarioCajaId" = $1 FOR UPDATE`,
      [registro.RegistroDiarioCajaId]
    )
  ).rows[0];
};

// Grupos "USD CON COTIZACION" (pagos 8, envíos 15): el monto va en Gs. y la
// cotización convierte a dólares para la cuenta USD. Sólo en ellos se guarda
// el cambio (igual que WesternPagosTab).
const esGrupoConCotizacion = (tipoGastoId, grupoId) =>
  (tipoGastoId === 1 && grupoId === 8) || (tipoGastoId === 2 && grupoId === 15);

// Actualizar un envío/pago Western manteniendo en sintonía su registro de
// caja. Cambiar el grupo (ej. de USD a Gs.), el monto o la cotización es una
// reclasificación: exige motivo, revierte en las cajas el efecto del grupo
// anterior y aplica el del nuevo (mismas reglas que WesternPagosTab), y
// conserva el ID del registro, así sigue en su turno: si ese turno ya se
// cerró no se toca la caja del cajero y se recalcula la diferencia de ese
// cierre. La caja, el tipo (pago/envío) y la fecha no se pueden cambiar en un
// movimiento ya registrado en caja. Todo en una transacción.
exports.update = async (req, res) => {
  const errorConStatus = (status, message) =>
    Object.assign(new Error(message), { status });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const anterior = (
      await client.query(
        `SELECT * FROM "westernenvio" WHERE "WesternEnvioId" = $1 FOR UPDATE`,
        [req.params.id]
      )
    ).rows[0];
    if (!anterior) throw errorConStatus(404, "Envío western no encontrado");
    const registro = await registroDelEnvio(client, anterior);

    // Sin registro de caja (movimientos viejos): se edita sólo el envío
    if (!registro) {
      const envio = await WesternEnvio.update(req.params.id, req.body, client);
      if (!envio) throw errorConStatus(404, "Envío western no encontrado");
      await client.query("COMMIT");
      return res.json({ message: "Envío western actualizado exitosamente", data: envio });
    }

    const viene = (campo) =>
      req.body[campo] !== undefined && req.body[campo] !== null && req.body[campo] !== "";
    for (const [campo, nombre] of [
      ["CajaId", "la caja"],
      ["TipoGastoId", "el tipo (pago/envío)"],
    ]) {
      if (viene(campo) && Number(req.body[campo]) !== Number(anterior[campo])) {
        throw errorConStatus(
          400,
          `No se puede cambiar ${nombre} de un movimiento Western ya registrado en caja: eliminalo y volvé a cargarlo.`
        );
      }
    }
    if (viene("WesternEnvioFecha")) {
      const minutos = Math.abs(
        new Date(req.body.WesternEnvioFecha) - new Date(anterior.WesternEnvioFecha)
      ) / 60000;
      if (!(minutos < 1)) {
        throw errorConStatus(
          400,
          "No se puede cambiar la fecha de un movimiento Western ya registrado en caja."
        );
      }
    }

    const tipoGastoId = Number(anterior.TipoGastoId);
    const grupoAnterior = Number(anterior.TipoGastoGrupoId);
    const grupoNuevo = viene("TipoGastoGrupoId") ? Number(req.body.TipoGastoGrupoId) : grupoAnterior;
    const montoAnterior = Number(anterior.WesternEnvioMonto) || 0;
    const montoNuevo = viene("WesternEnvioMonto") ? Number(req.body.WesternEnvioMonto) : montoAnterior;
    if (!Number.isFinite(montoNuevo) || montoNuevo <= 0) {
      throw errorConStatus(400, "El monto debe ser un número mayor a cero");
    }
    const conCotizacion = esGrupoConCotizacion(tipoGastoId, grupoNuevo);
    const cambioNuevo = conCotizacion
      ? Number(viene("WesternEnvioCambio") ? req.body.WesternEnvioCambio : anterior.WesternEnvioCambio) || 0
      : 0;
    if (conCotizacion && !(cambioNuevo > 0)) {
      throw errorConStatus(400, "Indicá la cotización del dólar para un grupo con cotización.");
    }

    const reclasifica =
      grupoNuevo !== grupoAnterior ||
      montoNuevo !== montoAnterior ||
      (conCotizacion && cambioNuevo !== Number(anterior.WesternEnvioCambio));

    let cierreId = null;
    let descripciones = null;
    let motivo = "";
    if (reclasifica) {
      const grupos = (
        await client.query(
          `SELECT "TipoGastoGrupoId", TRIM("TipoGastoGrupoDescripcion") AS d FROM "tipogastogrupo"
           WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = ANY($2::int[])`,
          [tipoGastoId, [grupoAnterior, grupoNuevo]]
        )
      ).rows;
      descripciones = {
        anterior: grupos.find((g) => g.TipoGastoGrupoId === grupoAnterior)?.d || `#${grupoAnterior}`,
        nuevo: grupos.find((g) => g.TipoGastoGrupoId === grupoNuevo)?.d || "",
      };
      if (!esGrupoWestern(descripciones.nuevo)) {
        throw errorConStatus(400, "El grupo elegido no es un grupo Western del mismo tipo (pago/envío).");
      }
      motivo = typeof req.body.Motivo === "string" ? req.body.Motivo.trim() : "";
      if (!motivo) {
        throw errorConStatus(400, "Indicá el motivo: cambiar el grupo, el monto o la cotización corrige la caja.");
      }

      cierreId = await RegistroDiarioCaja.getCierreDeTurnoCerrado(registro, client);
      const omitirCajaRegistro = Boolean(cierreId);
      // Revertir el efecto del grupo anterior y aplicar el del nuevo
      await revertirWestern(client, registro, montoAnterior, omitirCajaRegistro);
      await revertirWestern(
        client,
        {
          ...registro,
          TipoGastoGrupoId: grupoNuevo,
          RegistroDiarioCajaMonto: montoNuevo,
          RegistroDiarioCajaCambio: cambioNuevo,
        },
        -montoNuevo,
        omitirCajaRegistro
      );
    }

    // El envío y su registro quedan con los mismos valores (siguen emparejados)
    const datosEnvio = { ...req.body };
    delete datosEnvio.CajaId;
    delete datosEnvio.TipoGastoId;
    delete datosEnvio.WesternEnvioFecha;
    delete datosEnvio.Motivo;
    Object.assign(datosEnvio, {
      TipoGastoGrupoId: grupoNuevo,
      WesternEnvioMonto: montoNuevo,
      WesternEnvioCambio:
        reclasifica || conCotizacion ? cambioNuevo : anterior.WesternEnvioCambio,
    });
    const envio = await WesternEnvio.update(req.params.id, datosEnvio, client);

    await client.query(
      `UPDATE "registrodiariocaja" SET
         "TipoGastoGrupoId" = $1,
         "RegistroDiarioCajaMonto" = $2,
         "RegistroDiarioCajaCambio" = $3,
         "RegistroDiarioCajaDetalle" = $4,
         "RegistroDiarioCajaMTCN" = $5,
         "RegistroDiarioCajaCargoEnvio" = $6
       WHERE "RegistroDiarioCajaId" = $7`,
      [
        grupoNuevo,
        montoNuevo,
        reclasifica ? cambioNuevo : registro.RegistroDiarioCajaCambio,
        viene("WesternEnvioDetalle") ? req.body.WesternEnvioDetalle : registro.RegistroDiarioCajaDetalle,
        viene("WesternEnvioMTCN") ? Number(req.body.WesternEnvioMTCN) || 0 : registro.RegistroDiarioCajaMTCN,
        req.body.WesternEnvioCargoEnvio !== undefined
          ? Number(req.body.WesternEnvioCargoEnvio) || 0
          : registro.RegistroDiarioCajaCargoEnvio,
        registro.RegistroDiarioCajaId,
      ]
    );

    if (reclasifica) {
      const textoMotivo = `Reclasificación Western: ${descripciones.anterior} -> ${descripciones.nuevo} (${motivo})`;
      const diferencia = cierreId
        ? await CierreDiferencia.registrarParaCierre(
            client,
            cierreId,
            `Mov. #${registro.RegistroDiarioCajaId} reclasificado (${motivo})`
          )
        : null;
      await RegistroCorreccion.registrar(client, {
        tipo: "CORRECCION",
        registro,
        montoNuevo,
        detalleNuevo: viene("WesternEnvioDetalle")
          ? req.body.WesternEnvioDetalle
          : registro.RegistroDiarioCajaDetalle,
        cierreId,
        diferencia,
        motivo: textoMotivo,
        usuarioId: req.user.id,
      });
    }
    await client.query("COMMIT");

    res.json({
      message: !reclasifica
        ? "Envío western actualizado exitosamente"
        : cierreId
          ? "Movimiento Western reclasificado. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre y la caja del turno en curso no cambió."
          : "Movimiento Western reclasificado: se corrigieron las cajas.",
      data: envio,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (!error.status) console.error("Error al actualizar envío western:", error);
    res.status(error.status || 400).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Eliminar un envío/pago Western junto con su registro de caja, en una
// transacción: revierte las cajas con las reglas de WesternPagosTab y, si el
// movimiento es de un turno ya cerrado, no toca la caja del cajero, recalcula
// la diferencia de ese cierre y lo audita con el motivo recibido.
exports.delete = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const envio = (
      await client.query(
        `SELECT * FROM "westernenvio" WHERE "WesternEnvioId" = $1 FOR UPDATE`,
        [req.params.id]
      )
    ).rows[0];
    if (!envio) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Envío western no encontrado" });
    }

    const registro = await registroDelEnvio(client, envio);
    let cierreId = null;
    if (registro) {
      ({ cierreId } = await aplicarEnTurno(client, registro, {
        eliminar: true,
        revertir: revertirWestern,
        motivo: motivoEliminacion(req, `Eliminación del movimiento Western #${envio.WesternEnvioId}`),
        usuarioId: req.user.id,
      }));
    }
    await WesternEnvio.delete(req.params.id, client);
    await client.query("COMMIT");

    res.json({
      message: cierreId
        ? "Movimiento Western eliminado. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre."
        : "Envío western eliminado exitosamente",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el envío western porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar envío western:", error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};
