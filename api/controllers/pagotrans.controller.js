const PagoTrans = require("../models/pagotrans.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

// Obtener todos los pagos con paginación
exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "PagoTransFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    const result = await PagoTrans.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener pagos de transporte:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar pagos
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "PagoTransFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await PagoTrans.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de pagos de transporte:", error);
    res.status(500).json({ error: "Error al buscar pagos de transporte" });
  }
};

// Obtener un pago por ID
exports.getById = async (req, res) => {
  try {
    const pagoTrans = await PagoTrans.getById(req.params.id);
    if (!pagoTrans) {
      return res
        .status(404)
        .json({ message: "Pago de transporte no encontrado" });
    }
    res.json(pagoTrans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo pago
exports.create = async (req, res) => {
  try {
    const pagoTrans = await PagoTrans.create({
      ...req.body,
      PagoTransUsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Pago de transporte creado exitosamente",
      data: pagoTrans,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un pago
exports.update = async (req, res) => {
  try {
    const pagoTrans = await PagoTrans.update(req.params.id, req.body);
    if (!pagoTrans) {
      return res
        .status(404)
        .json({ message: "Pago de transporte no encontrado" });
    }
    res.json({
      message: "Pago de transporte actualizado exitosamente",
      data: pagoTrans,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un pago
exports.delete = async (req, res) => {
  try {
    // Obtener el pago antes de eliminarlo para tener los datos necesarios
    const pagoTrans = await PagoTrans.getById(req.params.id);
    if (!pagoTrans) {
      return res
        .status(404)
        .json({ message: "Pago de transporte no encontrado" });
    }

    const { PagoTransId, TransporteId } = pagoTrans;

    // Buscar el registro relacionado en registrodiariocaja usando PagoTransId y TransporteId
    const registrosRelacionadosResult = await db.query(
      `SELECT "RegistroDiarioCajaId", "RegistroDiarioCajaMonto"
       FROM "registrodiariocaja"
       WHERE "RegistroDiarioCajaDetalle" LIKE $1
       AND "RegistroDiarioCajaDetalle" LIKE $2`,
      [`%PagoTransId:${PagoTransId}%`, `%TransporteId:${TransporteId}%`]
    );
    const registrosRelacionados = registrosRelacionadosResult.rows;

    // Eliminar el pago primero
    const success = await PagoTrans.delete(req.params.id);
    if (!success) {
      return res
        .status(404)
        .json({ message: "Pago de transporte no encontrado" });
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

                  // Determinar la operación base
                  let operacionBase;
                  if (esIngreso) {
                    // Si era ingreso, al eliminar sumamos el monto
                    operacionBase = cajaMontoActual + monto;
                  } else {
                    // Si era egreso, al eliminar restamos el monto
                    operacionBase = cajaMontoActual - monto;
                  }

                  // Si CajaTipoId === 1, hacer operación opuesta
                  if (cajaTipoId === 1) {
                    // Invertir la operación
                    if (esIngreso) {
                      // Si era ingreso y CajaTipoId=1: restar en lugar de sumar
                      nuevoMonto = cajaMontoActual - monto;
                    } else {
                      // Si era egreso y CajaTipoId=1: sumar en lugar de restar
                      nuevoMonto = cajaMontoActual + monto;
                    }
                  } else {
                    // Para otros CajaTipoId, usar la operación base
                    nuevoMonto = operacionBase;
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

    res.json({ message: "Pago de transporte eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el pago porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar pago de transporte:", error);
    res.status(500).json({ message: error.message });
  }
};
