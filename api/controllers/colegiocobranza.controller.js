const ColegioCobranza = require("../models/colegiocobranza.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const Nomina = require("../models/nomina.model");
const Colegio = require("../models/colegio.model");
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
    const cobranza = await ColegioCobranza.create(req.body);
    res.status(201).json({
      message: "Cobranza creada exitosamente",
      data: cobranza,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar una cobranza
exports.update = async (req, res) => {
  try {
    const cobranza = await ColegioCobranza.update(req.params.id, req.body);
    if (!cobranza) {
      return res.status(404).json({ message: "Cobranza no encontrada" });
    }
    res.json({
      message: "Cobranza actualizada exitosamente",
      data: cobranza,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar una cobranza
exports.delete = async (req, res) => {
  try {
    // Obtener la cobranza antes de eliminarla para tener los datos necesarios
    const cobranza = await ColegioCobranza.getById(req.params.id);
    if (!cobranza) {
      return res.status(404).json({ message: "Cobranza no encontrada" });
    }

    const { CajaId, ColegioCobranzaFecha, UsuarioId, NominaId } = cobranza;

    // Obtener la nómina para saber el ColegioId
    const nomina = await Nomina.getById(NominaId);
    if (!nomina || !nomina.ColegioId) {
      // Si no hay nómina o colegio, solo eliminar la cobranza
      const success = await ColegioCobranza.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cobranza no encontrada" });
      }
      return res.json({ message: "Cobranza eliminada exitosamente" });
    }

    // Obtener el colegio para saber TipoGastoId y TipoGastoGrupoId
    const colegio = await Colegio.getById(nomina.ColegioId);
    if (!colegio || !colegio.TipoGastoId || !colegio.TipoGastoGrupoId) {
      // Si no hay colegio o no tiene TipoGastoId/TipoGastoGrupoId, solo eliminar la cobranza
      const success = await ColegioCobranza.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cobranza no encontrada" });
      }
      return res.json({ message: "Cobranza eliminada exitosamente" });
    }

    // Obtener el ColegioCobranzaId antes de eliminar
    const colegioCobranzaId = cobranza.ColegioCobranzaId;

    // Buscar el registro relacionado en registrodiariocaja usando NominaId y ColegioCobranzaId
    const registrosRelacionadosResult = await db.query(
      `SELECT "RegistroDiarioCajaId", "RegistroDiarioCajaMonto"
       FROM "registrodiariocaja"
       WHERE "RegistroDiarioCajaDetalle" LIKE $1
       AND "RegistroDiarioCajaDetalle" LIKE $2`,
      [`%NominaId:${NominaId}%`, `%ColegioCobranzaId:${colegioCobranzaId}%`]
    );
    const registrosRelacionados = registrosRelacionadosResult.rows;

    // Eliminar la cobranza primero
    const success = await ColegioCobranza.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Cobranza no encontrada" });
    }

    // Si hay registros relacionados, eliminar cada uno y actualizar montos
    if (registrosRelacionados && registrosRelacionados.length > 0) {
      for (const registro of registrosRelacionados) {
        const registroCompleto = await RegistroDiarioCaja.getById(
          registro.RegistroDiarioCajaId
        );
        if (registroCompleto) {
          const {
            TipoGastoId: regTipoGastoId,
            TipoGastoGrupoId: regTipoGastoGrupoId,
            RegistroDiarioCajaMonto: regMonto,
            CajaId: regCajaId,
          } = registroCompleto;

          // Determinar si es ingreso (TipoGastoId === 2) o egreso (TipoGastoId === 1)
          const esIngreso = regTipoGastoId === 2;
          const monto = Number(regMonto) || 0;
          const regCajaIdNumero = regCajaId ? Number(regCajaId) : null;

          // La caja aperturada y las demás cajas se movieron en direcciones
          // OPUESTAS al crear la cobranza (ver CobranzaTab.handleSubmit):
          //   INGRESO -> aperturada +monto, demás -monto
          //   EGRESO  -> aperturada -monto, demás +monto
          // Por eso el reverso debe separar la caja del registro de las demás
          // y aplicarles el signo contrario al que recibieron al crearse.

          // 1) Revertir la caja aperturada (la del registro)
          if (regCajaIdNumero) {
            const cajaAperturadaResult = await db.query(
              'SELECT "CajaMonto" FROM "caja" WHERE "CajaId" = $1',
              [regCajaIdNumero]
            );
            const cajaAperturada =
              cajaAperturadaResult.rows.length > 0
                ? cajaAperturadaResult.rows[0]
                : null;

            if (cajaAperturada) {
              const montoActual = Number(cajaAperturada.CajaMonto) || 0;
              // INGRESO sumó -> ahora resta; EGRESO restó -> ahora suma
              const nuevoMonto = esIngreso
                ? montoActual - monto
                : montoActual + monto;

              await db.query(
                'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
                [nuevoMonto, regCajaIdNumero]
              );
            }
          }

          // 2) Revertir las demás cajas (incluida la caja del colegio),
          //    excluyendo la caja aperturada
          const cajasIdsDemas = new Set();
          if (regTipoGastoId && regTipoGastoGrupoId) {
            const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
              regTipoGastoId,
              regTipoGastoGrupoId
            );
            cajasConGasto.forEach((cajaGasto) => {
              if (
                cajaGasto.CajaId &&
                Number(cajaGasto.CajaId) !== regCajaIdNumero
              ) {
                cajasIdsDemas.add(Number(cajaGasto.CajaId));
              }
            });
          }

          if (cajasIdsDemas.size > 0) {
            const actualizaciones = Array.from(cajasIdsDemas).map(
              async (cajaIdParaActualizar) => {
                // Obtener el monto actual de la caja
                const cajaActualResult = await db.query(
                  'SELECT "CajaMonto" FROM "caja" WHERE "CajaId" = $1',
                  [cajaIdParaActualizar]
                );
                const cajaActual = cajaActualResult.rows.length > 0 ? cajaActualResult.rows[0] : null;

                if (cajaActual) {
                  const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
                  // En la creación las demás cajas recibieron el signo OPUESTO
                  // a la aperturada, así que el reverso también es opuesto:
                  //   INGRESO restó a las demás -> ahora suma
                  //   EGRESO  sumó a las demás  -> ahora resta
                  const nuevoMonto = esIngreso
                    ? cajaMontoActual + monto
                    : cajaMontoActual - monto;

                  // Actualizar el monto de la caja
                  await db.query(
                    'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
                    [nuevoMonto, cajaIdParaActualizar]
                  );
                }
              }
            );

            await Promise.all(actualizaciones);
          }

          // Eliminar el registro de registrodiariocaja
          await RegistroDiarioCaja.delete(registro.RegistroDiarioCajaId);
        }
      }
    }

    res.json({ message: "Cobranza eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar cobranza:", error);
    res.status(500).json({ message: error.message });
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
    );

    const MULTA_POR_DIA = 1000;
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
