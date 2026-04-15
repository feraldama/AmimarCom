const ColegioCurso = require("../models/colegiocurso.model");

// Obtener todos los cursos
exports.getAll = async (req, res) => {
  try {
    const cursos = await ColegioCurso.getAll();
    res.json(cursos);
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener cursos por colegio
exports.getByColegioId = async (req, res) => {
  try {
    const cursos = await ColegioCurso.getByColegioId(req.params.colegioId);
    res.json(cursos);
  } catch (error) {
    console.error("Error al obtener cursos del colegio:", error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener un curso por ID (requiere ColegioId y ColegioCursoId)
exports.getById = async (req, res) => {
  try {
    const { colegioId, cursoId } = req.params;
    const curso = await ColegioCurso.getById(colegioId, cursoId);
    if (!curso) {
      return res.status(404).json({ message: "Curso no encontrado" });
    }
    res.json(curso);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo curso
exports.create = async (req, res) => {
  try {
    if (!req.body.ColegioId || !req.body.ColegioCursoNombre) {
      return res.status(400).json({
        success: false,
        message: "Los campos ColegioId y ColegioCursoNombre son requeridos",
      });
    }
    const curso = await ColegioCurso.create(req.body);
    res.status(201).json({
      message: "Curso creado exitosamente",
      data: curso,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un curso (requiere ColegioId y ColegioCursoId)
exports.update = async (req, res) => {
  try {
    const { colegioId, cursoId } = req.params;
    const curso = await ColegioCurso.update(colegioId, cursoId, req.body);
    if (!curso) {
      return res.status(404).json({ message: "Curso no encontrado" });
    }
    res.json({
      message: "Curso actualizado exitosamente",
      data: curso,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un curso (requiere ColegioId y ColegioCursoId)
exports.delete = async (req, res) => {
  try {
    const { colegioId, cursoId } = req.params;
    const success = await ColegioCurso.delete(colegioId, cursoId);
    if (!success) {
      return res.status(404).json({ message: "Curso no encontrado" });
    }
    res.json({ message: "Curso eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
