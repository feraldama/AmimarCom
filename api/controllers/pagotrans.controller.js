const PagoTrans = require("../models/pagotrans.model");
const { parseCajaIds } = require("../utils/reportes");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const { revertirPorTipoDeCaja } = require("../utils/ajusteCajas");
const { crearHandlersCobroVinculado } = require("../utils/cobroVinculado");

// Obtener todos los pagos con paginación
// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  transporteId: query.transporteId || undefined,
  cajaId: query.cajaId || undefined,
});

exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "PagoTransFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    const result = await PagoTrans.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener pagos de transporte:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar pagos
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "PagoTransFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await PagoTrans.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de pagos de transporte:", error);
    res.status(500).json({ error: "Error al buscar pagos de transporte" });
  }
};

// Obtener un pago por ID
exports.getById = async (req, res) => {
  try {
    const pagoTrans = await PagoTrans.getById(req.params.id);
    if (!pagoTrans) {
      return res
        .status(404)
        .json({ message: "Pago de transporte no encontrado" });
    }
    res.json(pagoTrans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo pago
exports.create = async (req, res) => {
  try {
    await RegistroDiarioCaja.validarFechaEnTurno(req.body.CajaId, req.body.PagoTransFecha);
    const pagoTrans = await PagoTrans.create({
      ...req.body,
      PagoTransUsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Pago de transporte creado exitosamente",
      data: pagoTrans,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Editar y eliminar un pago de transporte mantienen su registro de caja en
// sintonía (ver utils/cobroVinculado.js): corregir el monto de un pago de un
// turno ya cerrado recalcula la diferencia de ese cierre sin descuadrar el
// turno en curso. Al crearse (EmpresasTransporteTab.handleSubmit) el registro
// deja "PagoTransId:<id> TransporteId:<id>" en el detalle; la empresa define el
// grupo de gasto, por eso tampoco puede cambiar una vez registrado.
const handlersPagoTrans = crearHandlersCobroVinculado({
  Modelo: PagoTrans,
  tabla: "pagotrans",
  campoId: "PagoTransId",
  campoMonto: "PagoTransMonto",
  camposFijos: ["CajaId", "TransporteId"],
  getRegistros: async (pago, q) =>
    (
      await q.query(
        `SELECT * FROM "registrodiariocaja"
         WHERE "RegistroDiarioCajaDetalle" LIKE $1
         AND "RegistroDiarioCajaDetalle" LIKE $2`,
        [`%PagoTransId:${pago.PagoTransId}%`, `%TransporteId:${pago.TransporteId}%`]
      )
    ).rows,
  revertir: revertirPorTipoDeCaja,
  nombre: "Pago de transporte",
});

// Actualizar un pago
exports.update = handlersPagoTrans.update;

// Eliminar un pago
exports.delete = handlersPagoTrans.delete;

// Reporte: ventas de pasajes de una empresa de transporte, con la
// liquidación a la empresa (monto menos la comisión del transporte).
exports.reportePagos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, transporteId } = req.query;
    if (!fechaInicio || !fechaFin || !transporteId) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio, fechaFin y transporteId",
      });
    }

    const registros = await PagoTrans.getReportePagos(
      fechaInicio,
      fechaFin,
      transporteId,
      parseCajaIds(req.query),
    );

    const comisionPct = registros.length
      ? Number(registros[0].TransporteComision) || 0
      : 0;

    const data = registros.map((r) => {
      const monto = Number(r.PagoTransMonto) || 0;
      return {
        PagoTransId: r.PagoTransId,
        NumeroBoleto: (r.PagoTransNumeroBoleto || "").trim(),
        Fecha: r.PagoTransFecha,
        Pasajero: (r.PagoTransNombreApellido || "").trim(),
        Origen: (r.PagoTransOrigen || "").trim(),
        Destino: (r.PagoTransDestino || "").trim(),
        Monto: monto,
        Liquidacion: monto * (1 - comisionPct / 100),
        UsuarioId: r.PagoTransUsuarioId,
        UsuarioNombre: (r.UsuarioNombre || "").trim(),
      };
    });

    const totalMonto = data.reduce((s, r) => s + r.Monto, 0);
    const totalLiquidacion = data.reduce((s, r) => s + r.Liquidacion, 0);

    res.json({
      fechaInicio,
      fechaFin,
      transporteId,
      transporteNombre: registros.length
        ? (registros[0].TransporteNombre || "").trim()
        : "",
      comisionPct,
      data,
      totalMonto,
      totalLiquidacion,
      totalComision: totalMonto - totalLiquidacion,
    });
  } catch (error) {
    console.error("Error al generar reporte de empresa de transporte:", error);
    res.status(500).json({ message: error.message });
  }
};
