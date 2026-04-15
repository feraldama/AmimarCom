const Venta = require("../models/venta.model");

exports.getAll = async (req, res) => {
  try {
    const ventas = await Venta.getAll();
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPaginated = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "VentaId";
    const sortOrder = req.query.sortOrder || "ASC";

    const result = await Venta.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json({
      data: result.ventas,
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
    const venta = await Venta.getById(req.params.id);
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }
    res.json(venta);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const venta = await Venta.create(req.body);
    res.status(201).json({
      message: "Venta creada exitosamente",
      data: venta,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const venta = await Venta.update(req.params.id, req.body);
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }
    res.json({
      message: "Venta actualizada exitosamente",
      data: venta,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const success = await Venta.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }
    res.json({ message: "Venta eliminada exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar la venta porque tiene registros asociados.",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.searchVentas = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "VentaId";
    const sortOrder = req.query.sortOrder || "ASC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res.status(400).json({
        error: "El término de búsqueda no puede estar vacío",
      });
    }

    const result = await Venta.searchVentas(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json({
      data: result.ventas,
      pagination: {
        totalItems: result.total,
        totalPages: Math.ceil(result.total / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error al buscar ventas" });
  }
};

// Obtener ventas pendientes por cliente
exports.getVentasPendientesPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { localId } = req.query;

    if (!clienteId) {
      return res.status(400).json({
        success: false,
        message: "El ID del cliente es requerido",
      });
    }

    const ventas = await Venta.getVentasPendientesPorCliente(
      clienteId,
      localId
    );
    res.json({
      success: true,
      data: ventas,
    });
  } catch (error) {
    console.error("Error al obtener ventas pendientes:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener ventas pendientes",
      error: error.message,
    });
  }
};

// Obtener deudas pendientes agrupadas por cliente
exports.getDeudasPendientesPorCliente = async (req, res) => {
  try {
    const deudas = await Venta.getDeudasPendientesPorCliente();
    res.json({ success: true, data: deudas });
  } catch (error) {
    console.error("Error al obtener deudas pendientes por cliente:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener deudas pendientes por cliente",
      error: error.message,
    });
  }
};

// Reporte: Ventas por Tipo de Pago
exports.reporteVentasPorTipoPago = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }
    const data = await Venta.getVentasPorTipoPago(fechaInicio, fechaFin);
    res.json({ fechaInicio, fechaFin, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Ventas por Usuario/Cajero
exports.reporteVentasPorUsuario = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }
    const data = await Venta.getVentasPorUsuario(fechaInicio, fechaFin);
    res.json({ fechaInicio, fechaFin, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Deudas pendientes (para PDF)
exports.reporteDeudasPendientes = async (req, res) => {
  try {
    const data = await Venta.getDeudasPendientesPorCliente();
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
