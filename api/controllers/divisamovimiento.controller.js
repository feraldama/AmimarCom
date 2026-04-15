const DivisaMovimiento = require("../models/divisamovimiento.model");

// Obtener todos los movimientos de divisa con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "DivisaMovimientoId";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await DivisaMovimiento.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener movimientos de divisa:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar movimientos de divisa
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "DivisaMovimientoId";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await DivisaMovimiento.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de movimientos de divisa:", error);
    res.status(500).json({ error: "Error al buscar movimientos de divisa" });
  }
};

// Obtener un movimiento de divisa por ID
exports.getById = async (req, res) => {
  try {
    const divisaMovimiento = await DivisaMovimiento.getById(req.params.id);
    if (!divisaMovimiento) {
      return res
        .status(404)
        .json({ message: "Movimiento de divisa no encontrado" });
    }
    res.json(divisaMovimiento);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo movimiento de divisa
exports.create = async (req, res) => {
  try {
    if (
      !req.body.CajaId ||
      !req.body.DivisaMovimientoTipo ||
      !req.body.DivisaId ||
      !req.body.UsuarioId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Los campos CajaId, DivisaMovimientoTipo, DivisaId y UsuarioId son requeridos",
      });
    }
    const divisaMovimiento = await DivisaMovimiento.create(req.body);
    res.status(201).json({
      message: "Movimiento de divisa creado exitosamente",
      data: divisaMovimiento,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un movimiento de divisa
exports.update = async (req, res) => {
  try {
    const divisaMovimiento = await DivisaMovimiento.update(
      req.params.id,
      req.body
    );
    if (!divisaMovimiento) {
      return res
        .status(404)
        .json({ message: "Movimiento de divisa no encontrado" });
    }
    res.json({
      message: "Movimiento de divisa actualizado exitosamente",
      data: divisaMovimiento,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un movimiento de divisa
exports.delete = async (req, res) => {
  try {
    const success = await DivisaMovimiento.delete(req.params.id);
    if (!success) {
      return res
        .status(404)
        .json({ message: "Movimiento de divisa no encontrado" });
    }
    res.json({ message: "Movimiento de divisa eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el movimiento porque tiene registros asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Historial de cambio de divisas
exports.reporteHistorial = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }
    const data = await DivisaMovimiento.getReporteHistorial(fechaInicio, fechaFin);
    const resumen = await DivisaMovimiento.getReporteResumen(fechaInicio, fechaFin);
    res.json({ fechaInicio, fechaFin, data, resumen });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
