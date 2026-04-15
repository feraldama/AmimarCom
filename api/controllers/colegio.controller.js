const Colegio = require("../models/colegio.model");

// Obtener todos los colegios con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "ColegioId";
  const sortOrder = req.query.sortOrder || "ASC";
  try {
    const result = await Colegio.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener colegios:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar colegios
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "ColegioId";
    const sortOrder = req.query.sortOrder || "ASC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await Colegio.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de colegios:", error);
    res.status(500).json({ error: "Error al buscar colegios" });
  }
};

// Obtener un colegio por ID
exports.getById = async (req, res) => {
  try {
    const colegio = await Colegio.getById(req.params.id);
    if (!colegio) {
      return res.status(404).json({ message: "Colegio no encontrado" });
    }
    res.json(colegio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo colegio
exports.create = async (req, res) => {
  try {
    if (!req.body.ColegioNombre) {
      return res.status(400).json({
        success: false,
        message: "El campo ColegioNombre es requerido",
      });
    }
    const colegio = await Colegio.create(req.body);
    res.status(201).json({
      message: "Colegio creado exitosamente",
      data: colegio,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un colegio
exports.update = async (req, res) => {
  try {
    const colegio = await Colegio.update(req.params.id, req.body);
    if (!colegio) {
      return res.status(404).json({ message: "Colegio no encontrado" });
    }
    res.json({
      message: "Colegio actualizado exitosamente",
      data: colegio,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un colegio
exports.delete = async (req, res) => {
  try {
    const success = await Colegio.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Colegio no encontrado" });
    }
    res.json({ message: "Colegio eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el colegio porque tiene cursos asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};
