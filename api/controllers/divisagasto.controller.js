const DivisaGasto = require("../models/divisagasto.model");

// Obtener todos los gastos de divisa
exports.getAll = async (req, res) => {
  try {
    const divisaGastos = await DivisaGasto.getAll();
    res.json(divisaGastos);
  } catch (error) {
    console.error("Error al obtener gastos de divisa:", error);
    res.status(500).json({ message: error.message });
  }
};

// Obtener un gasto de divisa por ID
exports.getById = async (req, res) => {
  try {
    const divisaGasto = await DivisaGasto.getById(req.params.id);
    if (!divisaGasto) {
      return res.status(404).json({ message: "Gasto de divisa no encontrado" });
    }
    res.json(divisaGasto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener gastos por DivisaId
exports.getByDivisaId = async (req, res) => {
  try {
    const divisaGastos = await DivisaGasto.getByDivisaId(req.params.divisaId);
    res.json(divisaGastos);
  } catch (error) {
    console.error("Error al obtener gastos de divisa:", error);
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo gasto de divisa
exports.create = async (req, res) => {
  try {
    if (
      !req.body.DivisaId ||
      !req.body.TipoGastoId ||
      !req.body.TipoGastoGrupoId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Los campos DivisaId, TipoGastoId y TipoGastoGrupoId son requeridos",
      });
    }
    const divisaGasto = await DivisaGasto.create(req.body);
    res.status(201).json({
      message: "Gasto de divisa creado exitosamente",
      data: divisaGasto,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un gasto de divisa
exports.update = async (req, res) => {
  try {
    const divisaGasto = await DivisaGasto.update(req.params.id, req.body);
    if (!divisaGasto) {
      return res.status(404).json({ message: "Gasto de divisa no encontrado" });
    }
    res.json({
      message: "Gasto de divisa actualizado exitosamente",
      data: divisaGasto,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un gasto de divisa
exports.delete = async (req, res) => {
  try {
    const success = await DivisaGasto.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Gasto de divisa no encontrado" });
    }
    res.json({ message: "Gasto de divisa eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
