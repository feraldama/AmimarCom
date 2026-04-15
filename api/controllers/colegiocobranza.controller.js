const ColegioCobranza = require("../models/colegiocobranza.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const Nomina = require("../models/nomina.model");
const Colegio = require("../models/colegio.model");
const db = require("../config/db");

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
      sortOrder
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
      sortOrder
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

          // Conjunto de IDs de cajas a actualizar
          const cajasIdsParaActualizar = new Set();

          // Agregar la caja del registro
          if (regCajaId) {
            cajasIdsParaActualizar.add(Number(regCajaId));
          }

          // Obtener todas las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId en cajagasto
          if (regTipoGastoId && regTipoGastoGrupoId) {
            const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
              regTipoGastoId,
              regTipoGastoGrupoId
            );
            cajasConGasto.forEach((cajaGasto) => {
              if (cajaGasto.CajaId) {
                cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
              }
            });
          }

          // Actualizar el monto de todas las cajas afectadas
          if (cajasIdsParaActualizar.size > 0) {
            const actualizaciones = Array.from(cajasIdsParaActualizar).map(
              async (cajaIdParaActualizar) => {
                // Obtener el monto actual de la caja
                const cajaActualResult = await db.query(
                  'SELECT "CajaMonto" FROM "caja" WHERE "CajaId" = $1',
                  [cajaIdParaActualizar]
                );
                const cajaActual = cajaActualResult.rows.length > 0 ? cajaActualResult.rows[0] : null;

                if (cajaActual) {
                  const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
                  let nuevoMonto;

                  if (esIngreso) {
                    // Si era ingreso, al eliminar restamos el monto
                    nuevoMonto = cajaMontoActual - monto;
                  } else {
                    // Si era egreso, al eliminar sumamos el monto
                    nuevoMonto = cajaMontoActual + monto;
                  }

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
