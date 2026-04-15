const Divisa = require("../models/divisa.model");

// Obtener todas las divisas con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "DivisaId";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await Divisa.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener divisas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar divisas
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "DivisaId";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await Divisa.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de divisas:", error);
    res.status(500).json({ error: "Error al buscar divisas" });
  }
};

// Obtener una divisa por ID
exports.getById = async (req, res) => {
  try {
    const divisa = await Divisa.getById(req.params.id);
    if (!divisa) {
      return res.status(404).json({ message: "Divisa no encontrada" });
    }
    res.json(divisa);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear una nueva divisa
exports.create = async (req, res) => {
  try {
    if (!req.body.DivisaNombre) {
      return res.status(400).json({
        success: false,
        message: "El campo DivisaNombre es requerido",
      });
    }
    const divisa = await Divisa.create(req.body);
    res.status(201).json({
      message: "Divisa creada exitosamente",
      data: divisa,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar una divisa
exports.update = async (req, res) => {
  try {
    const divisa = await Divisa.update(req.params.id, req.body);
    if (!divisa) {
      return res.status(404).json({ message: "Divisa no encontrada" });
    }
    res.json({
      message: "Divisa actualizada exitosamente",
      data: divisa,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar una divisa
exports.delete = async (req, res) => {
  try {
    const success = await Divisa.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Divisa no encontrada" });
    }
    res.json({ message: "Divisa eliminada exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar la divisa porque tiene movimientos asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};
