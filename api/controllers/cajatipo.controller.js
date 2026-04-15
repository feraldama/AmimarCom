const CajaTipo = require("../models/cajatipo.model");

exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "CajaTipoId";
  const sortOrder = req.query.sortOrder || "ASC";
  try {
    const result = await CajaTipo.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json({
      data: result.cajaTipos,
      pagination: {
        totalItems: result.total,
        totalPages: Math.ceil(result.total / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const cajaTipo = await CajaTipo.getById(req.params.id);
    if (!cajaTipo) {
      return res.status(404).json({ message: "Tipo de caja no encontrado" });
    }
    res.json(cajaTipo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const cajaTipo = await CajaTipo.create(req.body);
    res.status(201).json({
      message: "Tipo de caja creado exitosamente",
      data: cajaTipo,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const cajaTipo = await CajaTipo.update(req.params.id, req.body);
    if (!cajaTipo) {
      return res.status(404).json({ message: "Tipo de caja no encontrado" });
    }
    res.json({
      message: "Tipo de caja actualizado exitosamente",
      data: cajaTipo,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const success = await CajaTipo.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Tipo de caja no encontrado" });
    }
    res.json({ message: "Tipo de caja eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el tipo de caja porque tiene registros asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.searchCajaTipos = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "CajaTipoId";
    const sortOrder = req.query.sortOrder || "ASC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await CajaTipo.searchCajaTipos(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json({
      data: result.cajaTipos,
      pagination: {
        totalItems: result.total,
        totalPages: Math.ceil(result.total / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error al buscar tipos de caja" });
  }
};
