const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const { revertirMovimiento } = require("../utils/ajusteCajas");
const { aplicarEnTurno, motivoEliminacion } = require("../utils/correccionTurno");
const db = require("../config/db");
const { parseCajaIds } = require("../utils/reportes");

// Saldo teórico de la caja que el usuario logueado tiene abierta, para que el
// cierre muestre el sobrante/faltante en vivo mientras se cuenta el efectivo.
exports.saldoCajaAbierta = async (req, res) => {
  try {
    const estado = await RegistroDiarioCaja.getEstadoAperturaPorUsuario(
      req.user.id
    );
    if (!estado.cajaId) {
      return res.status(404).json({ message: "No tenés una caja abierta" });
    }
    const saldo = await RegistroDiarioCaja.getSaldoTeorico(
      estado.aperturaId,
      estado.cajaId
    );
    res.json({ cajaId: estado.cajaId, ...saldo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Registros del último turno cerrado por el usuario logueado en una caja, para
// generar el ticket de cierre (sin el límite de una consulta paginada).
exports.turnoCierre = async (req, res) => {
  try {
    const { cajaId } = req.query;
    if (!cajaId) {
      return res.status(400).json({ message: "Falta el parámetro cajaId" });
    }
    const turno = await RegistroDiarioCaja.getTurnoCierre(req.user.id, cajaId);
    if (!turno) {
      return res.status(404).json({
        message: "No se encontró una apertura y un cierre de esta caja para el usuario.",
      });
    }
    res.json(turno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Caja del usuario logueado (la abierta o la de su última apertura)
exports.miCaja = async (req, res) => {
  try {
    const caja = await RegistroDiarioCaja.getCajaDelUsuario(req.user.id);
    res.json(caja || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener todos los registros con paginación
// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  tipoGastoId: query.tipoGastoId || undefined,
  tipoGastoGrupoId: query.tipoGastoGrupoId || undefined,
});

// Agrega a cada fila del listado MotivoNoCorregible (null si se puede
// corregir), para que la pantalla deshabilite "Corregir" explicando por qué
const conMotivoNoCorregible = (result) => ({
  ...result,
  data: result.data.map((r) => ({
    ...r,
    MotivoNoCorregible: RegistroDiarioCaja.motivoNoCorregible(r),
  })),
});

exports.getAll = async (req, res) => {
  const sortBy = req.query.sortBy || "RegistroDiarioCajaFecha";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await RegistroDiarioCaja.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query),
    );
    res.json(conMotivoNoCorregible(result));
  } catch (error) {
    console.error("Error al obtener registros:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar registros
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "RegistroDiarioCajaFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await RegistroDiarioCaja.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query),
    );

    res.json(conMotivoNoCorregible(result));
  } catch (error) {
    console.error("Error en búsqueda de registros:", error);
    res.status(500).json({ error: "Error al buscar registros" });
  }
};

// Obtener un registro por ID
exports.getById = async (req, res) => {
  try {
    const registro = await RegistroDiarioCaja.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }
    res.json(registro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo registro
// Indica si el grupo de gasto corresponde a un pase entre cajas
// (descripción "PASE ..."). Esos movimientos sólo pueden crearse por el
// endpoint /pase, que genera las dos patas en una transacción.
const esGrupoPase = async (tipoGastoId, tipoGastoGrupoId) => {
  if (!tipoGastoId || !tipoGastoGrupoId) return false;
  const result = await db.query(
    `SELECT 1 FROM "tipogastogrupo"
     WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2
       AND TRIM("TipoGastoGrupoDescripcion") ILIKE 'PASE %'`,
    [tipoGastoId, tipoGastoGrupoId]
  );
  return result.rows.length > 0;
};

exports.create = async (req, res) => {
  try {
    // Los grupos "PASE ..." quedan reservados al endpoint /pase: crear una
    // sola pata por acá deja el pase desbalanceado (sobrante/faltante en el
    // cierre de la caja contraparte).
    if (await esGrupoPase(req.body.TipoGastoId, req.body.TipoGastoGrupoId)) {
      return res.status(400).json({
        message:
          "Los pases entre cajas deben registrarse desde la pestaña Pase de Cajas, que genera el egreso y el ingreso juntos.",
      });
    }
    await RegistroDiarioCaja.validarFechaEnTurno(
      req.body.CajaId,
      req.body.RegistroDiarioCajaFecha
    );

    const registro = await RegistroDiarioCaja.create({
      ...req.body,
      UsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Registro creado exitosamente",
      data: registro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Crear un pase entre cajas (egreso en origen + ingreso en destino, atómico)
exports.createPase = async (req, res) => {
  try {
    const {
      CajaOrigenId,
      CajaDestinoId,
      RegistroDiarioCajaFecha,
      RegistroDiarioCajaDetalle,
      RegistroDiarioCajaMonto,
    } = req.body;

    if (!CajaOrigenId || !CajaDestinoId) {
      return res
        .status(400)
        .json({ message: "Caja origen y caja destino son requeridas" });
    }
    if (Number(CajaOrigenId) === Number(CajaDestinoId)) {
      return res
        .status(400)
        .json({ message: "La caja origen y la caja destino no pueden ser la misma" });
    }
    const monto = Number(RegistroDiarioCajaMonto);
    if (!monto || isNaN(monto) || monto <= 0) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número mayor a cero" });
    }
    for (const cajaId of [CajaOrigenId, CajaDestinoId]) {
      await RegistroDiarioCaja.validarFechaEnTurno(cajaId, RegistroDiarioCajaFecha);
    }

    const resultado = await RegistroDiarioCaja.createPase({
      CajaOrigenId,
      CajaDestinoId,
      RegistroDiarioCajaFecha,
      RegistroDiarioCajaDetalle,
      RegistroDiarioCajaMonto: monto,
      UsuarioId: req.user.id,
    });

    res.status(201).json({
      message: "Pase registrado exitosamente",
      data: resultado,
    });
  } catch (error) {
    console.error("Error al registrar pase entre cajas:", error);
    res.status(400).json({ message: error.message });
  }
};

// Corregir el monto (y opcionalmente el detalle) de un movimiento sin
// eliminarlo. Conserva el ID, así el movimiento sigue perteneciendo a su turno:
// si es de un turno ya cerrado se recalcula la diferencia de ese cierre y no
// se toca la caja aperturada (esa plata ya se contó en el arqueo). Es la forma
// de arreglar un movimiento de un cierre anterior sin generar un faltante o
// sobrante en el turno en curso. Exige un motivo y queda auditado en
// registrocorreccion.
exports.corregir = async (req, res) => {
  const errorConStatus = (status, message) =>
    Object.assign(new Error(message), { status });
  const client = await db.connect();
  try {
    const montoNuevo = Number(req.body.RegistroDiarioCajaMonto);
    if (!Number.isFinite(montoNuevo) || montoNuevo < 0) {
      throw errorConStatus(400, "El monto debe ser un número mayor o igual a cero");
    }
    const motivo =
      typeof req.body.Motivo === "string" ? req.body.Motivo.trim() : "";
    if (!motivo) {
      throw errorConStatus(400, "Indicá el motivo de la corrección");
    }

    await client.query("BEGIN");
    // Bloquea el movimiento: dos correcciones simultáneas no pueden aplicar
    // el ajuste de saldos dos veces sobre el mismo monto anterior.
    const registro = (
      await client.query(
        `SELECT r.*, tg."TipoGastoGrupoDescripcion"
         FROM "registrodiariocaja" r
         LEFT JOIN "tipogastogrupo" tg
           ON tg."TipoGastoId" = r."TipoGastoId" AND tg."TipoGastoGrupoId" = r."TipoGastoGrupoId"
         WHERE r."RegistroDiarioCajaId" = $1
         FOR UPDATE OF r`,
        [req.params.id]
      )
    ).rows[0];
    if (!registro) throw errorConStatus(404, "Registro no encontrado");
    const motivoRechazo = RegistroDiarioCaja.motivoNoCorregible(registro);
    if (motivoRechazo) throw errorConStatus(400, motivoRechazo);

    const detalleNuevo =
      typeof req.body.RegistroDiarioCajaDetalle === "string" &&
      req.body.RegistroDiarioCajaDetalle.trim()
        ? req.body.RegistroDiarioCajaDetalle.trim()
        : registro.RegistroDiarioCajaDetalle;

    const { cierreId, diferencia } = await aplicarEnTurno(client, registro, {
      montoNuevo,
      detalleNuevo,
      revertir: revertirMovimiento,
      motivo,
      usuarioId: req.user.id,
    });
    await client.query("COMMIT");

    res.json({
      message: cierreId
        ? "Movimiento corregido. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre y el turno en curso no cambia."
        : "Movimiento corregido.",
      data: {
        registro: await RegistroDiarioCaja.getById(registro.RegistroDiarioCajaId),
        cierreId,
        diferencia,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (!error.status) console.error("Error al corregir registro:", error);
    res.status(error.status || 500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Eliminar un registro. Salvo los pases (que tienen su propia transacción),
// todo corre en una transacción con el movimiento bloqueado: revertir saldos,
// borrar y, si era de un turno ya cerrado, recalcular esa diferencia y
// auditarlo con el motivo recibido. Si algo falla no queda nada a medias.
exports.delete = async (req, res) => {
  const client = await db.connect();
  try {
    // Obtener el registro antes de eliminarlo para tener los datos necesarios
    const registro = await RegistroDiarioCaja.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    // Los pases entre cajas se eliminan por par: la pata pedida y su
    // contrapartida (si existe), revirtiendo ambos saldos en una transacción.
    // Este camino no pasa por la lógica de cajagasto de más abajo porque un
    // pase sólo afecta a las dos cajas involucradas.
    if (await esGrupoPase(registro.TipoGastoId, registro.TipoGastoGrupoId)) {
      const resultado = await RegistroDiarioCaja.deletePase(registro);
      return res.json({
        message: resultado.contrapartidaId
          ? "Pase eliminado exitosamente (egreso e ingreso)"
          : "Registro de pase eliminado exitosamente (no se encontró contrapartida)",
        data: resultado,
      });
    }

    await client.query("BEGIN");
    // Releído con bloqueo: si otro pedido lo corrigió o eliminó mientras
    // tanto, se trabaja sobre lo que quedó
    const bloqueado = (
      await client.query(
        `SELECT * FROM "registrodiariocaja" WHERE "RegistroDiarioCajaId" = $1 FOR UPDATE`,
        [registro.RegistroDiarioCajaId]
      )
    ).rows[0];
    if (!bloqueado) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    // Los registros de PAGO ADMIN no tocan saldos acá: ya se actualizan en
    // pagoadmin.controller.js al eliminar el pago admin (ver revertirMovimiento)
    const { cierreId } = await aplicarEnTurno(client, bloqueado, {
      eliminar: true,
      revertir: revertirMovimiento,
      motivo: motivoEliminacion(req, "Eliminación de un movimiento de un turno ya cerrado"),
      usuarioId: req.user.id,
    });
    await client.query("COMMIT");

    res.json({
      message: cierreId
        ? "Registro eliminado. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre."
        : "Registro eliminado exitosamente",
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
          "No se puede eliminar el registro porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar registro:", error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Último cierre de una caja (monto y fecha). El frontend lo usa para mostrar
// el monto con el que se va a aperturar. cierre: null si nunca se cerró.
exports.ultimoCierrePorCaja = async (req, res) => {
  try {
    const { cajaId } = req.query;
    if (!cajaId) {
      return res.status(400).json({ message: "Falta el parámetro cajaId" });
    }
    const cierre = await RegistroDiarioCaja.getUltimoCierre(cajaId);
    res.json({
      cierre: cierre
        ? {
            monto: Number(cierre.RegistroDiarioCajaMonto) || 0,
            fecha: cierre.RegistroDiarioCajaFecha,
          }
        : null,
    });
  } catch (error) {
    console.error("Error al consultar último cierre de caja:", error);
    res.status(500).json({ message: error.message });
  }
};

// Monto válido para el arqueo: número finito y no negativo
const montoValido = (v) => Number.isFinite(Number(v)) && Number(v) >= 0;

exports.aperturaCierreCaja = async (req, res) => {
  try {
    const {
      apertura,
      CajaId,
      Monto,
      RegistroDiarioCajaPendiente1,
      RegistroDiarioCajaPendiente2,
      RegistroDiarioCajaPendiente3,
      RegistroDiarioCajaPendiente4,
    } = req.body;
    const UsuarioId = req.user?.id || req.body.UsuarioId;
    if (
      !CajaId ||
      typeof apertura === "undefined" ||
      typeof Monto === "undefined" ||
      !UsuarioId
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos requeridos" });
    }
    // En la apertura el monto lo define el backend (último cierre), así que
    // sólo se valida lo que manda el cliente en el cierre.
    const pendientes = [
      RegistroDiarioCajaPendiente1,
      RegistroDiarioCajaPendiente2,
      RegistroDiarioCajaPendiente3,
      RegistroDiarioCajaPendiente4,
    ].map((p) => (p == null || p === "" ? 0 : p));
    if (apertura != 0 && ![Monto, ...pendientes].every(montoValido)) {
      return res.status(400).json({
        success: false,
        message: "El monto del cierre y los pendientes deben ser números mayores o iguales a 0",
      });
    }
    await RegistroDiarioCaja.aperturaCierre({
      apertura,
      CajaId,
      Monto: Number(Monto),
      pendientes: pendientes.map(Number),
      UsuarioId,
    });
    return res.json({
      success: true,
      message:
        apertura == 0
          ? "Apertura realizada correctamente"
          : "Cierre realizado correctamente",
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Error en apertura/cierre de caja:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// Nuevo endpoint para saber si el usuario tiene caja aperturada
exports.estadoAperturaPorUsuario = async (req, res) => {
  try {
    const usuarioId = req.query.usuarioId;
    if (!usuarioId) {
      return res.status(400).json({ message: "Falta el parámetro usuarioId" });
    }
    const estado =
      await RegistroDiarioCaja.getEstadoAperturaPorUsuario(usuarioId);
    res.json(estado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reporte de pase de cajas
exports.reportePaseCajas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    const { cajas, movimientos } = await RegistroDiarioCaja.getReportePaseCajas(
      fechaInicio,
      fechaFin,
      parseCajaIds(req.query),
    );

    // Todas las cajas tipo 1 se listan, tengan o no pases en el período
    const data = cajas.map((caja) => ({
      CajaId: caja.CajaId,
      CajaDescripcion: (caja.CajaDescripcion || "").trim(),
      pases: [],
    }));
    const porCajaId = Object.fromEntries(data.map((c) => [c.CajaId, c]));

    let totalEgresos = 0;
    let totalIngresos = 0;

    movimientos.forEach((m) => {
      const caja = porCajaId[m.CajaId];
      if (!caja) return; // pase registrado en una caja que no es tipo 1

      const monto = Number(m.RegistroDiarioCajaMonto) || 0;
      // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
      const esIngreso = m.TipoGastoId === 2;
      if (esIngreso) totalIngresos += monto;
      else totalEgresos += monto;

      caja.pases.push({
        RegistroDiarioCajaId: m.RegistroDiarioCajaId,
        Tipo: esIngreso ? "INGRESO" : "EGRESO",
        GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
        Fecha: m.RegistroDiarioCajaFecha,
        Monto: monto,
        UsuarioId: m.UsuarioId,
        UsuarioNombre: (m.UsuarioNombre || "").trim(),
        Detalle: m.RegistroDiarioCajaDetalle || "",
      });
    });

    res.json({
      fechaInicio,
      fechaFin,
      data,
      totalEgresos,
      totalIngresos,
      diferencia: totalIngresos - totalEgresos,
    });
  } catch (error) {
    console.error("Error al generar reporte de pase de cajas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte de movimientos de todas las cajas (CajaTipoId=1)
exports.reporteMovimientosCajas = async (req, res) => {
  try {
    // cajaIds: lista separada por comas (ej: "4,5"); se mantiene cajaId
    // (individual) por compatibilidad. tipo: 1=egresos, 2=ingresos.
    const { fechaInicio, fechaFin, cajaId, tipo } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    let listaCajas = parseCajaIds(req.query);
    if (listaCajas.length === 0 && cajaId) {
      listaCajas = [Number(cajaId)];
    }

    const tipoGastoId =
      tipo === "1" || tipo === "2" ? Number(tipo) : undefined;

    const registros = await RegistroDiarioCaja.getReporteMovimientosCajas(
      fechaInicio,
      fechaFin,
      listaCajas,
      tipoGastoId,
    );

    res.json({
      fechaInicio,
      fechaFin,
      data: registros,
    });
  } catch (error) {
    console.error("Error al generar reporte de movimientos de cajas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Cierre Diario de Caja
exports.reporteCierreDiario = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }
    const data = await RegistroDiarioCaja.getCierreDiario(
      fechaInicio,
      fechaFin,
      parseCajaIds(req.query),
    );
    res.json({ fechaInicio, fechaFin, data });
  } catch (error) {
    console.error("Error al generar reporte cierre diario:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Ingresos/Egresos Resumen (totales por grupo de tipo de gasto)
exports.reporteIngresosEgresos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    const grupos = await RegistroDiarioCaja.getReporteIngresosEgresos(
      fechaInicio,
      fechaFin,
      parseCajaIds(req.query),
    );

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = grupos.filter((g) => g.TipoGastoId === 1);
    const ingresos = grupos.filter((g) => g.TipoGastoId === 2);
    const totalEgresos = egresos.reduce((s, g) => s + Number(g.Total), 0);
    const totalIngresos = ingresos.reduce((s, g) => s + Number(g.Total), 0);

    res.json({
      fechaInicio,
      fechaFin,
      egresos,
      ingresos,
      totalEgresos,
      totalIngresos,
      saldo: totalIngresos - totalEgresos,
    });
  } catch (error) {
    console.error("Error al generar reporte ingresos/egresos:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Western Ingresos/Egresos. moneda=gs (grupos "1 WESTERN ...")
// o moneda=usd (grupos "2 WESTERN ...").
exports.reporteWestern = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, moneda } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    // Grupos por moneda: "1 WESTERN ..." son pagos/envíos en Gs.;
    // "2 WESTERN ..." son USD con cotización (monto en Gs. + cambio) y
    // "3 WESTERN ..." son USD puro (el monto ya está en dólares, sin cambio),
    // por eso el reporte USD incluye ambos prefijos.
    const prefijos =
      moneda === "usd" ? ["2 WESTERN", "3 WESTERN"] : ["1 WESTERN"];
    const registros = await RegistroDiarioCaja.getReporteWestern(
      fechaInicio,
      fechaFin,
      prefijos,
      parseCajaIds(req.query),
    );

    const mapear = (m) => ({
      RegistroDiarioCajaId: m.RegistroDiarioCajaId,
      GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
      Detalle: m.RegistroDiarioCajaDetalle || "",
      Fecha: m.RegistroDiarioCajaFecha,
      Monto: Number(m.RegistroDiarioCajaMonto) || 0,
      Cambio: Number(m.RegistroDiarioCajaCambio) || 0,
      MTCN: m.RegistroDiarioCajaMTCN,
      CajaDescripcion: (m.CajaDescripcion || "").trim(),
      UsuarioId: m.UsuarioId,
      UsuarioNombre: (m.UsuarioNombre || "").trim(),
      // En los grupos "3 WESTERN ..." el monto ya está en USD (no en Gs.)
      EsUsdPuro: (m.TipoGastoGrupoDescripcion || "")
        .trim()
        .toUpperCase()
        .startsWith("3 WESTERN"),
    });

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = registros.filter((m) => m.TipoGastoId === 1).map(mapear);
    const ingresos = registros.filter((m) => m.TipoGastoId === 2).map(mapear);
    // Totales en Gs.: los montos USD puro no se suman acá porque están en
    // otra moneda (el reporte USD calcula sus totales en dólares aparte).
    const totalEgresos = egresos
      .filter((m) => !m.EsUsdPuro)
      .reduce((s, m) => s + m.Monto, 0);
    const totalIngresos = ingresos
      .filter((m) => !m.EsUsdPuro)
      .reduce((s, m) => s + m.Monto, 0);

    res.json({
      fechaInicio,
      fechaFin,
      moneda: moneda === "usd" ? "usd" : "gs",
      egresos,
      ingresos,
      totalEgresos,
      totalIngresos,
      diferencia: totalEgresos - totalIngresos,
    });
  } catch (error) {
    console.error("Error al generar reporte western:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Anticipos (movimientos de un grupo de gasto por descripción,
// con egresos/ingresos, cotización y equivalente USD)
exports.reporteAnticipos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, grupo } = req.query;
    if (!fechaInicio || !fechaFin || !grupo) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio, fechaFin y grupo",
      });
    }

    const registros = await RegistroDiarioCaja.getReporteGrupo(
      fechaInicio,
      fechaFin,
      grupo,
      parseCajaIds(req.query),
    );

    let totalEgresos = 0;
    let totalIngresos = 0;
    let totalEgresosUsd = 0;
    let totalIngresosUsd = 0;
    let sumaCotizacion = 0;
    let cantConCotizacion = 0;

    const movimientos = registros.map((m) => {
      const monto = Number(m.RegistroDiarioCajaMonto) || 0;
      const cambio = Number(m.RegistroDiarioCajaCambio) || 0;
      const montoUsd = cambio > 0 ? monto / cambio : 0;
      // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
      const esIngreso = m.TipoGastoId === 2;
      if (esIngreso) {
        totalIngresos += monto;
        totalIngresosUsd += montoUsd;
      } else {
        totalEgresos += monto;
        totalEgresosUsd += montoUsd;
      }
      if (cambio > 0) {
        sumaCotizacion += cambio;
        cantConCotizacion += 1;
      }
      return {
        RegistroDiarioCajaId: m.RegistroDiarioCajaId,
        Tipo: esIngreso ? "INGRESO" : "EGRESO",
        GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
        Detalle: m.RegistroDiarioCajaDetalle || "",
        Fecha: m.RegistroDiarioCajaFecha,
        Monto: monto,
        Cambio: cambio,
        MontoUsd: montoUsd,
        CajaDescripcion: (m.CajaDescripcion || "").trim(),
        UsuarioId: m.UsuarioId,
        UsuarioNombre: (m.UsuarioNombre || "").trim(),
      };
    });

    res.json({
      fechaInicio,
      fechaFin,
      grupo,
      movimientos,
      totalEgresos,
      totalIngresos,
      totalEgresosUsd,
      totalIngresosUsd,
      promedioCotizacion:
        cantConCotizacion > 0 ? sumaCotizacion / cantConCotizacion : 0,
    });
  } catch (error) {
    console.error("Error al generar reporte de anticipos:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: El Comercio (resumen de los grupos asociados a WEPA / WEPA USD)
exports.reporteElComercio = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    const grupos = await RegistroDiarioCaja.getReporteElComercio(
      fechaInicio,
      fechaFin,
      parseCajaIds(req.query),
    );

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = grupos.filter((g) => g.TipoGastoId === 1);
    const ingresos = grupos.filter((g) => g.TipoGastoId === 2);
    const sumar = (rows, campo) => rows.reduce((s, g) => s + Number(g[campo]), 0);

    res.json({
      fechaInicio,
      fechaFin,
      egresos,
      ingresos,
      totalEgresos: sumar(egresos, "Total"),
      totalIngresos: sumar(ingresos, "Total"),
      totalEgresosUsd: sumar(egresos, "TotalUsd"),
      totalIngresosUsd: sumar(ingresos, "TotalUsd"),
    });
  } catch (error) {
    console.error("Error al generar reporte El Comercio:", error);
    res.status(500).json({ message: error.message });
  }
};
