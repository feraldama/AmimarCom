const ColegioCobranza = require("../models/colegiocobranza.model");
const { parseCajaIds } = require("../utils/reportes");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const Nomina = require("../models/nomina.model");
const Colegio = require("../models/colegio.model");
const { revertirAperturadaYDemas } = require("../utils/ajusteCajas");
const { aplicarEnTurno, motivoEliminacion } = require("../utils/correccionTurno");
const db = require("../config/db");

// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  colegioId: query.colegioId || undefined,
});

// Obtener todas las cobranzas con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "ColegioCobranzaId";
  const sortOrder = req.query.sortOrder || "ASC";
  try {
    const result = await ColegioCobranza.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener cobranzas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar cobranzas
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "ColegioCobranzaId";
    const sortOrder = req.query.sortOrder || "ASC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await ColegioCobranza.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de cobranzas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener una cobranza por ID
exports.getById = async (req, res) => {
  try {
    const cobranza = await ColegioCobranza.getById(req.params.id);
    if (!cobranza) {
      return res.status(404).json({ message: "Cobranza no encontrada" });
    }
    res.json(cobranza);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear una nueva cobranza
exports.create = async (req, res) => {
  try {
    await RegistroDiarioCaja.validarFechaEnTurno(
      req.body.CajaId,
      req.body.ColegioCobranzaFecha
    );
    const cobranza = await ColegioCobranza.create(req.body);
    res.status(201).json({
      message: "Cobranza creada exitosamente",
      data: cobranza,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Registros de registrodiariocaja creados junto con la cobranza
// (CobranzaColegiosTab deja "NominaId:<id> ColegioCobranzaId:<id>" en el detalle).
const getRegistrosDeCobranza = async (nominaId, colegioCobranzaId, q = db) => {
  const result = await q.query(
    `SELECT * FROM "registrodiariocaja"
     WHERE "RegistroDiarioCajaDetalle" LIKE $1
     AND "RegistroDiarioCajaDetalle" LIKE $2`,
    [`%NominaId:${nominaId}%`, `%ColegioCobranzaId:${colegioCobranzaId}%`]
  );
  return result.rows;
};

// Total cobrado, con la misma fórmula que la pantalla de cobranza:
// importe del curso x meses + días de mora x 1.000 + examen - descuento
const MULTA_POR_DIA = 1000;
const calcularTotal = (cobranza, importe) =>
  Math.max(
    0,
    importe * (Number(cobranza.ColegioCobranzaMes) || 0) +
      (Number(cobranza.ColegioCobranzaDiasMora) || 0) * MULTA_POR_DIA +
      (Number(cobranza.ColegioCobranzaExamen) || 0) -
      (Number(cobranza.ColegioCobranzaDescuento) || 0)
  );

// Alumno con su colegio (grupo de gasto) e importe de la cuota de su curso
const getNominaConCurso = async (nominaId, q = db) => {
  const result = await q.query(
    `SELECT n."NominaId", n."NominaNombre", n."NominaApellido", n."ColegioId",
            col."ColegioNombre", col."TipoGastoId", col."TipoGastoGrupoId",
            cur."ColegioCursoImporte"
     FROM "nomina" n
     LEFT JOIN "colegio" col ON col."ColegioId" = n."ColegioId"
     LEFT JOIN "colegiocurso" cur
       ON cur."ColegioId" = n."ColegioId" AND cur."ColegioCursoId" = n."ColegioCursoId"
     WHERE n."NominaId" = $1`,
    [nominaId]
  );
  return result.rows[0];
};

// Actualizar una cobranza. Si cambia lo cobrado (meses, mora, examen,
// descuento o alumno) corrige también su registro de caja conservando su ID:
// así sigue en su turno y, si ese turno ya se cerró, se recalcula la
// diferencia de ese cierre sin descuadrar el turno en curso. El cambio en
// caja queda auditado en registrocorreccion. Todo corre en una transacción con
// la cobranza y su registro bloqueados, para que dos ediciones simultáneas no
// apliquen el ajuste dos veces.
exports.update = async (req, res) => {
  const errorConStatus = (status, message) =>
    Object.assign(new Error(message), { status });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const bloqueada = await client.query(
      `SELECT 1 FROM "colegiocobranza" WHERE "ColegioCobranzaId" = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (bloqueada.rows.length === 0) {
      throw errorConStatus(404, "Cobranza no encontrada");
    }
    const anterior = await ColegioCobranza.getById(req.params.id, client);
    const [registro] = await getRegistrosDeCobranza(
      anterior.NominaId,
      anterior.ColegioCobranzaId,
      client
    );
    // Mismo criterio que ColegioCobranza.update: vacío/null no pisa el valor
    const nueva = { ...anterior };
    for (const [campo, valor] of Object.entries(req.body)) {
      if (valor !== undefined && valor !== null && valor !== "") nueva[campo] = valor;
    }

    let ajuste = null;
    if (registro) {
      if (Number(nueva.CajaId) !== Number(registro.CajaId)) {
        throw errorConStatus(
          400,
          "No se puede cambiar la caja de una cobranza ya registrada en caja: eliminala y volvé a cargarla."
        );
      }
      const nominaAnterior = await getNominaConCurso(anterior.NominaId, client);
      const nominaNueva =
        Number(nueva.NominaId) === Number(anterior.NominaId)
          ? nominaAnterior
          : await getNominaConCurso(nueva.NominaId, client);
      if (!nominaNueva) throw errorConStatus(400, "Nómina no encontrada");
      if (
        Number(nominaNueva.TipoGastoId) !== Number(registro.TipoGastoId) ||
        Number(nominaNueva.TipoGastoGrupoId) !== Number(registro.TipoGastoGrupoId)
      ) {
        throw errorConStatus(
          400,
          "El alumno elegido es de otro colegio: eliminá la cobranza y volvé a cargarla."
        );
      }
      // Se aplica la diferencia entre totales (no el total recalculado) para
      // no arrastrar un cambio posterior del importe del curso.
      const diferencia =
        calcularTotal(nueva, Number(nominaNueva.ColegioCursoImporte) || 0) -
        calcularTotal(anterior, Number(nominaAnterior?.ColegioCursoImporte) || 0);
      const alumno = `${(nominaNueva.NominaApellido || "").trim()}, ${(
        nominaNueva.NominaNombre || ""
      ).trim()}`;
      ajuste = {
        diferencia,
        detalle: `Cobranza Colegio: ${(nominaNueva.ColegioNombre || "").trim()} - Nómina: ${alumno} | NominaId:${nominaNueva.NominaId} ColegioCobranzaId:${anterior.ColegioCobranzaId}`,
      };
    }

    const cobranza = await ColegioCobranza.update(req.params.id, req.body, client);
    let cierreId = null;
    if (ajuste) {
      ({ cierreId } = await aplicarEnTurno(client, registro, {
        montoNuevo: (Number(registro.RegistroDiarioCajaMonto) || 0) + ajuste.diferencia,
        detalleNuevo: ajuste.detalle,
        revertir: revertirAperturadaYDemas,
        motivo: `Edición de la cobranza de colegio #${anterior.ColegioCobranzaId}`,
        usuarioId: req.user.id,
      }));
    }
    await client.query("COMMIT");

    res.json({
      message: cierreId
        ? "Cobranza actualizada. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre."
        : "Cobranza actualizada exitosamente",
      data: cobranza,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error.status || 400).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Eliminar una cobranza. Corre en una transacción con la cobranza bloqueada:
// se borra la cobranza y cada registro de caja asociado (revirtiendo saldos y,
// si era de un turno ya cerrado, recalculando esa diferencia y auditándolo).
// Si algo falla no queda nada a medias.
exports.delete = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const bloqueada = await client.query(
      `SELECT 1 FROM "colegiocobranza" WHERE "ColegioCobranzaId" = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (bloqueada.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Cobranza no encontrada" });
    }
    // Obtener la cobranza antes de eliminarla para tener los datos necesarios
    const cobranza = await ColegioCobranza.getById(req.params.id, client);
    const { NominaId } = cobranza;

    // Sólo si la nómina tiene un colegio con TipoGastoId y TipoGastoGrupoId
    // la cobranza generó registros de caja; si no, se elimina sólo la cobranza
    const nomina = await Nomina.getById(NominaId);
    const colegio =
      nomina && nomina.ColegioId ? await Colegio.getById(nomina.ColegioId) : null;
    const registrosRelacionados =
      colegio && colegio.TipoGastoId && colegio.TipoGastoGrupoId
        ? await getRegistrosDeCobranza(NominaId, cobranza.ColegioCobranzaId, client)
        : [];

    await ColegioCobranza.delete(req.params.id, client);

    // Eliminar cada registro relacionado revirtiendo los saldos. Si es de un
    // turno ya cerrado no se toca la caja aperturada y se recalcula la
    // diferencia de ese cierre.
    let turnoCerrado = false;
    const motivo = motivoEliminacion(
      req,
      `Eliminación de la cobranza de colegio #${cobranza.ColegioCobranzaId}`
    );
    for (const registro of registrosRelacionados) {
      const { cierreId } = await aplicarEnTurno(client, registro, {
        eliminar: true,
        revertir: revertirAperturadaYDemas,
        motivo,
        usuarioId: req.user.id,
      });
      if (cierreId) turnoCerrado = true;
    }
    await client.query("COMMIT");

    res.json({
      message: turnoCerrado
        ? "Cobranza eliminada. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre."
        : "Cobranza eliminada exitosamente",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al eliminar cobranza:", error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Reporte: cobranzas de un colegio agrupables por curso, con los importes
// derivados igual que en la pantalla de cobranza:
//   Subtotal = Importe del curso x cantidad de meses
//   Multa    = días de mora x 1.000 Gs.
//   Total    = Subtotal + Multa + Examen - Descuento
exports.reporteCobranzas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, colegioId } = req.query;
    if (!fechaInicio || !fechaFin || !colegioId) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio, fechaFin y colegioId",
      });
    }

    const registros = await ColegioCobranza.getReporteCobranzas(
      fechaInicio,
      fechaFin,
      colegioId,
      parseCajaIds(req.query),
    );

    const comisionPct = registros.length
      ? Number(registros[0].ColegioComision) || 0
      : 0;
    const data = registros.map((r) => {
      const importe = Number(r.ColegioCursoImporte) || 0;
      const meses = Number(r.ColegioCobranzaMes) || 1;
      const subtotal = importe * meses;
      const dias = Number(r.ColegioCobranzaDiasMora) || 0;
      const multa = dias * MULTA_POR_DIA;
      const examen = Number(r.ColegioCobranzaExamen) || 0;
      const descuento = Number(r.ColegioCobranzaDescuento) || 0;
      // Comisión: % del colegio sobre (importe de la cuota - descuento)
      const comision = ((importe - descuento) * comisionPct) / 100;
      return {
        ColegioCobranzaId: r.ColegioCobranzaId,
        CursoNombre: (r.ColegioCursoNombre || "Sin curso").trim(),
        Apellido: (r.NominaApellido || "").trim(),
        Nombre: (r.NominaNombre || "").trim(),
        Fecha: r.ColegioCobranzaFecha,
        MesPagado: (r.ColegioCobranzaMesPagado || "").trim(),
        Importe: importe,
        Meses: meses,
        Subtotal: subtotal,
        DiasMora: dias,
        Multa: multa,
        Examen: examen,
        Descuento: descuento,
        Total: subtotal + multa + examen - descuento,
        Comision: comision,
        UsuarioNombre: (r.UsuarioNombre || "").trim(),
      };
    });

    const totales = data.reduce(
      (t, r) => ({
        Subtotal: t.Subtotal + r.Subtotal,
        Multa: t.Multa + r.Multa,
        Examen: t.Examen + r.Examen,
        Descuento: t.Descuento + r.Descuento,
        Total: t.Total + r.Total,
        Comision: t.Comision + r.Comision,
      }),
      { Subtotal: 0, Multa: 0, Examen: 0, Descuento: 0, Total: 0, Comision: 0 },
    );

    res.json({
      fechaInicio,
      fechaFin,
      colegioId,
      colegioNombre: registros.length
        ? (registros[0].ColegioNombre || "").trim()
        : "",
      comisionPct,
      data,
      totales,
    });
  } catch (error) {
    console.error("Error al generar reporte de cobranza de colegio:", error);
    res.status(500).json({ message: error.message });
  }
};
