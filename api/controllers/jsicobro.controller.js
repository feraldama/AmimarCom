const JSICobro = require("../models/jsicobro.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

const CAJA_JSI_ID = 23;

// Obtener todos los cobros con paginación
exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "JSICobroFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    const result = await JSICobro.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener cobros de JSI:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar cobros
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "JSICobroFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await JSICobro.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de cobros de JSI:", error);
    res.status(500).json({ error: "Error al buscar cobros de JSI" });
  }
};

// Obtener un cobro por ID
exports.getById = async (req, res) => {
  try {
    const jsicobro = await JSICobro.getById(req.params.id);
    if (!jsicobro) {
      return res.status(404).json({ message: "Cobro de JSI no encontrado" });
    }
    res.json(jsicobro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo cobro
exports.create = async (req, res) => {
  try {
    const jsicobro = await JSICobro.create({
      ...req.body,
      JSICobroUsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Cobro de JSI creado exitosamente",
      data: jsicobro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un cobro
exports.update = async (req, res) => {
  try {
    const jsicobro = await JSICobro.update(req.params.id, req.body);
    if (!jsicobro) {
      return res.status(404).json({ message: "Cobro de JSI no encontrado" });
    }
    res.json({
      message: "Cobro de JSI actualizado exitosamente",
      data: jsicobro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un cobro
exports.delete = async (req, res) => {
  try {
    const jsicobroId = req.params.id;

    // Obtener el cobro antes de eliminarlo para tener el ID
    const jsicobro = await JSICobro.getById(jsicobroId);
    if (!jsicobro) {
      return res.status(404).json({ message: "Cobro de JSI no encontrado" });
    }

    // Buscar el registro relacionado en registrodiariocaja usando JSICobroId
    const registrosRelacionadosResult = await db.query(
      `SELECT "RegistroDiarioCajaId"
       FROM "registrodiariocaja"
       WHERE "RegistroDiarioCajaDetalle" LIKE $1`,
      [`%JSICobroId:${jsicobroId}%`]
    );
    const registrosRelacionados = registrosRelacionadosResult.rows;

    // Eliminar el cobro de JSI primero
    const success = await JSICobro.delete(jsicobroId);
    if (!success) {
      return res.status(404).json({ message: "Cobro de JSI no encontrado" });
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
                // Obtener el monto actual y CajaTipoId de la caja
                const cajaActualResult = await db.query(
                  'SELECT "CajaMonto", "CajaTipoId" FROM "caja" WHERE "CajaId" = $1',
                  [cajaIdParaActualizar]
                );
                const cajaActual = cajaActualResult.rows.length > 0 ? cajaActualResult.rows[0] : null;

                if (cajaActual) {
                  const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
                  const cajaTipoId = Number(cajaActual.CajaTipoId);
                  let nuevoMonto;

                  // Lógica según CajaTipoId
                  if (cajaTipoId === 1) {
                    // Si CajaTipoId === 1: RESTAR el monto
                    nuevoMonto = cajaMontoActual - monto;
                  } else {
                    // Si CajaTipoId !== 1: SUMAR el monto
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

    res.json({ message: "Cobro de JSI eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el cobro porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar cobro de JSI:", error);
    res.status(500).json({ message: error.message });
  }
};
