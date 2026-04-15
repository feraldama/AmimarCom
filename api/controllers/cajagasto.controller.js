const CajaGasto = require("../models/cajagasto.model");

exports.getAll = async (req, res) => {
  try {
    const gastos = await CajaGasto.getAll();
    res.json(gastos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const gasto = await CajaGasto.getById(req.params.id);
    if (!gasto) {
      return res.status(404).json({ message: "Gasto de caja no encontrado" });
    }
    res.json(gasto);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getByCajaId = async (req, res) => {
  try {
    const gastos = await CajaGasto.getByCajaId(req.params.cajaId);
    res.json(gastos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getByTipoGastoAndGrupo = async (req, res) => {
  try {
    const { tipoGastoId, tipoGastoGrupoId } = req.params;
    const gastos = await CajaGasto.getByTipoGastoAndGrupo(
      tipoGastoId,
      tipoGastoGrupoId
    );
    res.json(gastos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const gasto = await CajaGasto.create(req.body);
    res
      .status(201)
      .json({ message: "Gasto de caja creado exitosamente", data: gasto });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const gasto = await CajaGasto.update(req.params.id, req.body);
    if (!gasto) {
      return res.status(404).json({ message: "Gasto de caja no encontrado" });
    }
    res.json({
      message: "Gasto de caja actualizado exitosamente",
      data: gasto,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const success = await CajaGasto.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Gasto de caja no encontrado" });
    }
    res.json({ message: "Gasto de caja eliminado exitosamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
