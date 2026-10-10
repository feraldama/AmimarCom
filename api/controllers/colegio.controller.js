const Colegio = require("../models/colegio.model");

// Reporte: estado de resultados por colegio en un rango de fechas
//   RESULTADO = INGRESOS - RETIROS - SALARIOS
// colegioId opcional (sin él, todos los colegios). Siempre todas las cajas.
// Los ingresos del concepto propio del colegio se informan en dos líneas:
// los de la pantalla de cobranzas y los cargados a mano en la caja (Manual),
// para que se vea cuánto del ingreso no tiene cobranza de alumno detrás.
exports.estadoResultados = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, colegioId } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    const filas = await Colegio.getEstadoResultados(
      fechaInicio,
      fechaFin,
      colegioId,
    );

    const RUBROS = { INGRESO: "ingresos", RETIRO: "retiros", SALARIO: "salarios" };
    const porColegio = new Map();
    filas.forEach((f) => {
      if (!porColegio.has(f.ColegioId)) {
        porColegio.set(f.ColegioId, {
          ColegioId: f.ColegioId,
          ColegioNombre: (f.ColegioNombre || "").trim(),
          ingresos: [],
          retiros: [],
          salarios: [],
        });
      }
      const lista = porColegio.get(f.ColegioId)[RUBROS[f.Rubro]];
      if (!lista) return;
      const concepto = {
        TipoGastoId: f.TipoGastoId,
        TipoGastoGrupoId: f.TipoGastoGrupoId,
        GrupoDescripcion: (f.GrupoDescripcion || "").trim(),
        CantMovimientos: Number(f.CantMovimientos) || 0,
        Total: Number(f.Total) || 0,
        Manual: false,
      };
      if (!f.Propio) {
        lista.push(concepto);
        return;
      }
      const cantCobranzas = Number(f.CantCobranzas) || 0;
      const totalCobranzas = Number(f.TotalCobranzas) || 0;
      lista.push(
        {
          ...concepto,
          GrupoDescripcion: `${concepto.GrupoDescripcion} - cobranzas`,
          CantMovimientos: cantCobranzas,
          Total: totalCobranzas,
        },
        {
          ...concepto,
          GrupoDescripcion: `${concepto.GrupoDescripcion} - cargados a mano en caja`,
          CantMovimientos: concepto.CantMovimientos - cantCobranzas,
          Total: concepto.Total - totalCobranzas,
          Manual: true,
        },
      );
    });

    const sumar = (lista) => lista.reduce((s, c) => s + c.Total, 0);
    const colegios = Array.from(porColegio.values()).map((c) => {
      const totalIngresos = sumar(c.ingresos);
      const totalIngresosManuales = sumar(c.ingresos.filter((k) => k.Manual));
      const totalRetiros = sumar(c.retiros);
      const totalSalarios = sumar(c.salarios);
      return {
        ...c,
        totalIngresos,
        totalIngresosManuales,
        totalRetiros,
        totalSalarios,
        resultado: totalIngresos - totalRetiros - totalSalarios,
      };
    });

    const totales = colegios.reduce(
      (t, c) => ({
        ingresos: t.ingresos + c.totalIngresos,
        ingresosManuales: t.ingresosManuales + c.totalIngresosManuales,
        retiros: t.retiros + c.totalRetiros,
        salarios: t.salarios + c.totalSalarios,
        resultado: t.resultado + c.resultado,
      }),
      { ingresos: 0, ingresosManuales: 0, retiros: 0, salarios: 0, resultado: 0 },
    );

    res.json({ fechaInicio, fechaFin, colegios, totales });
  } catch (error) {
    console.error("Error al generar el estado de resultados de colegios:", error);
    res.status(500).json({ message: error.message });
  }
};

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

// ── Conceptos del estado de resultados (tabla colegiogasto) ──
// INGRESO: grupos de ingreso (TipoGastoId 2) además del propio del colegio.
// RETIRO / SALARIO: grupos de egreso (TipoGastoId 1).
const TIPO_GASTO_POR_RUBRO = { INGRESO: 2, RETIRO: 1, SALARIO: 1 };

exports.getConceptosResultado = async (req, res) => {
  try {
    const conceptos = await Colegio.getConceptosResultado(req.params.id);
    res.json(conceptos);
  } catch (error) {
    console.error("Error al obtener conceptos del colegio:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.addConceptoResultado = async (req, res) => {
  try {
    const colegioId = Number(req.params.id);
    const tipoGastoId = Number(req.body.TipoGastoId);
    const tipoGastoGrupoId = Number(req.body.TipoGastoGrupoId);
    const rubro = String(req.body.ColegioGastoRubro || "").toUpperCase();

    if (!TIPO_GASTO_POR_RUBRO[rubro]) {
      return res
        .status(400)
        .json({ message: "El rubro debe ser INGRESO, RETIRO o SALARIO" });
    }
    if (!tipoGastoGrupoId || tipoGastoId !== TIPO_GASTO_POR_RUBRO[rubro]) {
      return res.status(400).json({
        message:
          rubro === "INGRESO"
            ? "Para INGRESO elegí un grupo de ingreso"
            : `Para ${rubro} elegí un grupo de egreso`,
      });
    }
    const colegio = await Colegio.getById(colegioId);
    if (!colegio) {
      return res.status(404).json({ message: "Colegio no encontrado" });
    }
    // Un concepto pertenece a un solo colegio (si no, se suma dos veces)
    const usadoPor = await Colegio.getColegioDelConcepto(
      tipoGastoId,
      tipoGastoGrupoId,
    );
    if (usadoPor) {
      return res.status(400).json({
        message:
          Number(usadoPor.ColegioId) === colegioId
            ? "El grupo ya está asignado a este colegio"
            : `El grupo ya está asignado a ${(usadoPor.ColegioNombre || "").trim()}`,
      });
    }

    await Colegio.addConceptoResultado(
      colegioId,
      tipoGastoId,
      tipoGastoGrupoId,
      rubro,
    );
    res.status(201).json(await Colegio.getConceptosResultado(colegioId));
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ message: "El grupo de gasto no existe" });
    }
    console.error("Error al agregar concepto al colegio:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteConceptoResultado = async (req, res) => {
  try {
    const { id, tipoGastoId, tipoGastoGrupoId } = req.params;
    const ok = await Colegio.deleteConceptoResultado(
      id,
      tipoGastoId,
      tipoGastoGrupoId,
    );
    if (!ok) return res.status(404).json({ message: "Concepto no encontrado" });
    res.json(await Colegio.getConceptosResultado(id));
  } catch (error) {
    console.error("Error al quitar concepto del colegio:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: estado de resultados mes a mes (mismo cálculo que
// estadoResultados, por mes calendario). Máximo 12 meses, para que entre
// en una hoja apaisada.
const MAX_MESES_RESULTADO = 12;

// Meses "YYYY-MM" entre dos fechas ISO, ambos inclusive
const mesesEntre = (desde, hasta) => {
  const meses = [];
  let [a, m] = desde.slice(0, 7).split("-").map(Number);
  const [aFin, mFin] = hasta.slice(0, 7).split("-").map(Number);
  while (a < aFin || (a === aFin && m <= mFin)) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
};

exports.estadoResultadosMensual = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, colegioId } = req.query;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(fechaInicio || "") || !iso.test(fechaFin || "")) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin (AAAA-MM-DD)",
      });
    }
    const meses = mesesEntre(fechaInicio, fechaFin);
    if (meses.length > MAX_MESES_RESULTADO) {
      return res.status(400).json({
        message: `La vista mes por mes admite hasta ${MAX_MESES_RESULTADO} meses`,
      });
    }

    const filas = await Colegio.getEstadoResultadosMensual(
      fechaInicio,
      fechaFin,
      colegioId,
    );

    const vacio = () => ({
      ingresos: 0,
      ingresosManuales: 0,
      retiros: 0,
      salarios: 0,
      resultado: 0,
    });
    const sumarRubro = (acc, rubro, total, manual) => {
      if (rubro === "INGRESO") {
        acc.ingresos += total;
        acc.ingresosManuales += manual;
        acc.resultado += total;
      } else if (rubro === "RETIRO") {
        acc.retiros += total;
        acc.resultado -= total;
      } else if (rubro === "SALARIO") {
        acc.salarios += total;
        acc.resultado -= total;
      }
    };

    const porColegio = new Map();
    const totales = {
      porMes: Object.fromEntries(meses.map((m) => [m, vacio()])),
      total: vacio(),
    };
    filas.forEach((f) => {
      if (!porColegio.has(f.ColegioId)) {
        porColegio.set(f.ColegioId, {
          ColegioId: f.ColegioId,
          ColegioNombre: (f.ColegioNombre || "").trim(),
          porMes: Object.fromEntries(meses.map((m) => [m, vacio()])),
          total: vacio(),
        });
      }
      const c = porColegio.get(f.ColegioId);
      const total = Number(f.Total) || 0;
      const manual = Number(f.Manual) || 0;
      if (!c.porMes[f.Mes]) return;
      sumarRubro(c.porMes[f.Mes], f.Rubro, total, manual);
      sumarRubro(c.total, f.Rubro, total, manual);
      sumarRubro(totales.porMes[f.Mes], f.Rubro, total, manual);
      sumarRubro(totales.total, f.Rubro, total, manual);
    });

    res.json({
      fechaInicio,
      fechaFin,
      meses,
      colegios: Array.from(porColegio.values()),
      totales,
    });
  } catch (error) {
    console.error("Error al generar el estado de resultados mensual:", error);
    res.status(500).json({ message: error.message });
  }
};
