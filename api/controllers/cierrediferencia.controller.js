const CierreDiferencia = require("../models/cierrediferencia.model");

const TIPOS = ["con", "faltante", "sobrante"];

exports.getAll = async (req, res) => {
  try {
    const q = req.query;
    const cajaIdNum = parseInt(q.cajaId, 10);
    const result = await CierreDiferencia.getPaginated({
      page: Math.max(1, parseInt(q.page) || 1),
      limit: Math.min(200, Math.max(1, parseInt(q.limit) || 10)),
      fechaDesde: /^\d{4}-\d{2}-\d{2}$/.test(q.fechaDesde || "") ? q.fechaDesde : undefined,
      fechaHasta: /^\d{4}-\d{2}-\d{2}$/.test(q.fechaHasta || "") ? q.fechaHasta : undefined,
      cajaId: Number.isInteger(cajaIdNum) && cajaIdNum > 0 ? cajaIdNum : undefined,
      usuarioId: q.usuarioId || undefined,
      tipo: TIPOS.includes(q.tipo) ? q.tipo : undefined,
      revisado: ["S", "N"].includes(q.revisado) ? q.revisado : undefined,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDetalle = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Id inválido" });
    }
    const detalle = await CierreDiferencia.getDetalle(id);
    if (!detalle) {
      return res.status(404).json({ message: "Diferencia no encontrada" });
    }
    res.json(detalle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRevision = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Id inválido" });
    }
    const { observacion, revisado } = req.body || {};
    if (observacion != null && String(observacion).length > 500) {
      return res
        .status(400)
        .json({ message: "La observación no puede superar los 500 caracteres" });
    }
    const actualizado = await CierreDiferencia.updateRevision(
      id,
      { observacion: observacion == null ? "" : String(observacion), revisado: revisado === true },
      req.user.id
    );
    if (!actualizado) {
      return res.status(404).json({ message: "Diferencia no encontrada" });
    }
    res.json(await CierreDiferencia.getDetalle(id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
