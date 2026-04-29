const CierreDiario = require("../models/cierrediario.model");

exports.createSnapshot = async (req, res) => {
  try {
    const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const existing = await CierreDiario.countByFecha(fecha);
    if (existing > 0) {
      return res.status(409).json({
        message: `Ya existe un cierre diario para ${fecha} (${existing} cajas registradas).`,
        fecha,
        existing,
      });
    }
    const inserted = await CierreDiario.createSnapshot(fecha);
    res.status(201).json({
      message: `Cierre diario registrado para ${inserted} cajas.`,
      fecha,
      inserted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getHistorial = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { fechaDesde, fechaHasta, sortBy, sortOrder } = req.query;
    const result = await CierreDiario.getDatesPaginated(
      page,
      limit,
      fechaDesde,
      fechaHasta,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDetail = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: "Fecha inválida (formato esperado: YYYY-MM-DD)" });
    }
    const data = await CierreDiario.getDetailByFecha(fecha);
    res.json({ fecha, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
