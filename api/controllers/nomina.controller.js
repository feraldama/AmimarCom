const Nomina = require("../models/nomina.model");

// Obtener todas las nominas con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "NominaId";
  const sortOrder = req.query.sortOrder || "ASC";
  try {
    const result = await Nomina.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener nominas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar nominas
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "NominaId";
    const sortOrder = req.query.sortOrder || "ASC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await Nomina.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de nominas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener una nomina por ID
exports.getById = async (req, res) => {
  try {
    const nomina = await Nomina.getById(req.params.id);
    if (!nomina) {
      return res.status(404).json({ message: "Nomina no encontrada" });
    }
    res.json(nomina);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear una nueva nomina
exports.create = async (req, res) => {
  try {
    const nomina = await Nomina.create(req.body);
    res.status(201).json({
      message: "Nomina creada exitosamente",
      data: nomina,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar una nomina
exports.update = async (req, res) => {
  try {
    const nomina = await Nomina.update(req.params.id, req.body);
    if (!nomina) {
      return res.status(404).json({ message: "Nomina no encontrada" });
    }
    res.json({
      message: "Nomina actualizada exitosamente",
      data: nomina,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar una nomina
exports.delete = async (req, res) => {
  try {
    const success = await Nomina.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Nomina no encontrada" });
    }
    res.json({ message: "Nomina eliminada exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener todas las nominas sin paginación
exports.getAllNominasSinPaginacion = async (req, res) => {
  try {
    const nominas = await Nomina.getAll();
    res.json({ data: nominas });
  } catch (error) {
    console.error("Error al obtener todas las nominas:", error);
    res.status(500).json({ message: error.message });
  }
};
