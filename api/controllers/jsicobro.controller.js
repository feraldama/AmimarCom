const JSICobro = require("../models/jsicobro.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

const CAJA_JSI_ID = 14;

// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  clienteId: query.clienteId || undefined,
});

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
      sortOrder,
      parseFiltros(req.query)
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
      sortOrder,
      parseFiltros(req.query)
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

          const monto = Number(regMonto) || 0;
          const regCajaIdNumero = regCajaId ? Number(regCajaId) : null;

          // Al crear el cobro JSI (ver JuntaSaneamientoTab.handleSubmit) las
          // cajas se movieron así:
          //   caja aperturada            -> +monto
          //   demás cajas con el gasto   -> -monto (excluyendo la aperturada)
          // Al eliminar el movimiento aplicamos exactamente lo opuesto:
          //   caja aperturada            -> -monto
          //   demás cajas con el gasto   -> +monto

          // 1) Revertir la caja aperturada (la del registro): RESTAR el monto
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
              await db.query(
                'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
                [montoActual - monto, regCajaIdNumero]
              );
            }
          }

          // 2) Revertir las demás cajas con el gasto (excluyendo la
          //    aperturada): SUMAR el monto
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
                const cajaActualResult = await db.query(
                  'SELECT "CajaMonto" FROM "caja" WHERE "CajaId" = $1',
                  [cajaIdParaActualizar]
                );
                const cajaActual =
                  cajaActualResult.rows.length > 0
                    ? cajaActualResult.rows[0]
                    : null;

                if (cajaActual) {
                  const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
                  await db.query(
                    'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
                    [cajaMontoActual + monto, cajaIdParaActualizar]
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
