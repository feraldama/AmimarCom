const JSICobro = require("../models/jsicobro.model");
const { parseCajaIds } = require("../utils/reportes");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const { revertirAperturadaYDemas } = require("../utils/ajusteCajas");
const { crearHandlersCobroVinculado } = require("../utils/cobroVinculado");

const CAJA_JSI_ID = 14;

// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  clienteId: query.clienteId || undefined,
});

// Obtener todos los cobros con paginación
exports.getAll = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "JSICobroFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    const result = await JSICobro.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener cobros de JSI:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar cobros
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "JSICobroFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await JSICobro.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query)
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de cobros de JSI:", error);
    res.status(500).json({ error: "Error al buscar cobros de JSI" });
  }
};

// Obtener un cobro por ID
exports.getById = async (req, res) => {
  try {
    const jsicobro = await JSICobro.getById(req.params.id);
    if (!jsicobro) {
      return res.status(404).json({ message: "Cobro de JSI no encontrado" });
    }
    res.json(jsicobro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo cobro
exports.create = async (req, res) => {
  try {
    await RegistroDiarioCaja.validarFechaEnTurno(req.body.CajaId, req.body.JSICobroFecha);
    const jsicobro = await JSICobro.create({
      ...req.body,
      JSICobroUsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Cobro de JSI creado exitosamente",
      data: jsicobro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Editar y eliminar un cobro de JSI mantienen su registro de caja en sintonía
// (ver utils/cobroVinculado.js): corregir el monto de un cobro de un turno ya
// cerrado recalcula la diferencia de ese cierre sin descuadrar el turno en
// curso. Al crearse (JuntaSaneamientoTab.handleSubmit) el registro deja
// "JSICobroId:<id>" en el detalle.
const handlersJSI = crearHandlersCobroVinculado({
  Modelo: JSICobro,
  tabla: "jsicobro",
  campoId: "JSICobroId",
  campoMonto: "JSICobroMonto",
  camposFijos: ["CajaId"],
  getRegistros: async (cobro, q) =>
    (
      await q.query(
        `SELECT * FROM "registrodiariocaja" WHERE "RegistroDiarioCajaDetalle" LIKE $1`,
        [`%JSICobroId:${cobro.JSICobroId}%`]
      )
    ).rows,
  revertir: revertirAperturadaYDemas,
  nombre: "Cobro de JSI",
});

// Actualizar un cobro de JSI
exports.update = handlersJSI.update;

// Eliminar un cobro de JSI
exports.delete = handlersJSI.delete;

// Reporte: cobros JSI del período, para la rendición a la Junta de Saneamiento
exports.reporteCobros = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    const registros = await JSICobro.getReporteCobros(
      fechaInicio,
      fechaFin,
      parseCajaIds(req.query),
    );

    const data = registros.map((r) => ({
      JSICobroId: r.JSICobroId,
      Fecha: r.JSICobroFecha,
      ClienteId: r.ClienteId,
      ClienteCodJSI: r.ClienteCodJSI ? String(r.ClienteCodJSI).trim() : "",
      ClienteNombre: `${(r.ClienteNombre || "").trim()} ${(r.ClienteApellido || "").trim()}`.trim(),
      Monto: Number(r.JSICobroMonto) || 0,
      UsuarioId: r.JSICobroUsuarioId,
      UsuarioNombre: (r.UsuarioNombre || "").trim(),
    }));

    // Resumen por día para la rendición: comisión JSI fija del 1,78% sobre
    // lo cobrado cada día. Si algún día cambia el porcentaje, considerar
    // moverlo a una tabla de configuración.
    const COMISION_JSI_PCT = 1.78;
    const porDia = new Map();
    data.forEach((r) => {
      // Día en hora local (toISOString convertiría a UTC y correría de día
      // los cobros nocturnos)
      const f = new Date(r.Fecha);
      const dia = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
      porDia.set(dia, (porDia.get(dia) || 0) + r.Monto);
    });
    const resumen = Array.from(porDia.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dia, monto]) => ({
        Fecha: dia,
        Monto: monto,
        Comision: (monto * COMISION_JSI_PCT) / 100,
      }));

    res.json({
      fechaInicio,
      fechaFin,
      data,
      total: data.reduce((s, r) => s + r.Monto, 0),
      resumen,
      comisionPct: COMISION_JSI_PCT,
    });
  } catch (error) {
    console.error("Error al generar reporte de cobros JSI:", error);
    res.status(500).json({ message: error.message });
  }
};
