const Transporte = require("../models/transporte.model");

// Obtener todos los transportes con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "TransporteId";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await Transporte.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener transportes:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar transportes
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "TransporteId";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await Transporte.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de transportes:", error);
    res.status(500).json({ error: "Error al buscar transportes" });
  }
};

// Obtener un transporte por ID
exports.getById = async (req, res) => {
  try {
    const transporte = await Transporte.getById(req.params.id);
    if (!transporte) {
      return res.status(404).json({ message: "Transporte no encontrado" });
    }
    res.json(transporte);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo transporte
exports.create = async (req, res) => {
  try {
    if (!req.body.TransporteNombre) {
      return res.status(400).json({
        success: false,
        message: "El campo TransporteNombre es requerido",
      });
    }
    const transporte = await Transporte.create(req.body);
    res.status(201).json({
      message: "Transporte creado exitosamente",
      data: transporte,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un transporte
exports.update = async (req, res) => {
  try {
    const transporte = await Transporte.update(req.params.id, req.body);
    if (!transporte) {
      return res.status(404).json({ message: "Transporte no encontrado" });
    }
    res.json({
      message: "Transporte actualizado exitosamente",
      data: transporte,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un transporte
exports.delete = async (req, res) => {
  try {
    const success = await Transporte.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Transporte no encontrado" });
    }
    res.json({ message: "Transporte eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el transporte porque tiene movimientos asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};
