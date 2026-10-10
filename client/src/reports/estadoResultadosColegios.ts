import { jsPDF } from "jspdf";
import type { RowInput, Styles } from "jspdf-autotable";
import {
  getReporteEstadoResultados,
  getReporteEstadoResultadosMensual,
} from "../services/colegio.service";
import { formatMiles } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  pdfNota,
  abrirPdf,
  getLastY,
  SinDatosError,
  validarRango,
  type RGB,
} from "../utils/pdfReport";

interface ConceptoResultado {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  GrupoDescripcion: string;
  CantMovimientos: number;
  Total: number;
  /** Ingreso cargado a mano en la caja, sin cobranza de alumno detrás. */
  Manual: boolean;
}

interface ColegioResultado {
  ColegioId: number;
  ColegioNombre: string;
  ingresos: ConceptoResultado[];
  retiros: ConceptoResultado[];
  salarios: ConceptoResultado[];
  totalIngresos: number;
  totalIngresosManuales: number;
  totalRetiros: number;
  totalSalarios: number;
  resultado: number;
}

// Ámbar para resaltar los ingresos cargados a mano
const COLOR_MANUAL: RGB = [180, 83, 9];

// Celdas de encabezado / total alineadas como sus columnas
const der = (content: string) => ({ content, styles: { halign: "right" as const } });
const centro = (content: string) => ({ content, styles: { halign: "center" as const } });

const colorResultado = (n: number): RGB =>
  n < 0 ? PDF_COLORS.egreso : PDF_COLORS.ingreso;

const movimientos = (c: ColegioResultado) =>
  [...c.ingresos, ...c.retiros, ...c.salarios].reduce(
    (s, k) => s + k.CantMovimientos,
    0
  );

// Siempre todas las cajas: los ingresos y salarios de un colegio pasan por
// cajas distintas, filtrar por caja daría un resultado parcial.
export async function generarEstadoResultadosColegios(
  desde: string,
  hasta: string,
  colegioId: string
) {
  validarRango(desde, hasta);
  const r = await getReporteEstadoResultados(desde, hasta, colegioId);
  const colegios = (r.colegios || []) as ColegioResultado[];
  const conMovimientos = colegios.filter((c) => movimientos(c) > 0);
  if (!conMovimientos.length) {
    throw new SinDatosError("No hay movimientos de colegios en el periodo seleccionado");
  }

  const doc = new jsPDF();
  const titulo = colegioId ? "Estado de Resultados" : "Estado de Resultados - Colegios";
  let y = pdfHeader(doc, titulo, desde, hasta);

  // Resumen comparativo (solo con más de un colegio)
  if (!colegioId) {
    const t = r.totales || {};
    const manual = (n: number) => ({
      content: n ? formatMiles(n) : "",
      styles: { textColor: COLOR_MANUAL, halign: "right" as const },
    });
    y = pdfSeccion(doc, y, "RESUMEN", {
      head: ["Colegio", ...["Ingresos", "(a mano)", "Retiros", "Salarios", "Resultado"].map(der)],
      body: colegios.map((c) => [
        c.ColegioNombre,
        formatMiles(c.totalIngresos),
        manual(c.totalIngresosManuales),
        formatMiles(c.totalRetiros),
        formatMiles(c.totalSalarios),
        {
          content: formatMiles(c.resultado),
          styles: { textColor: colorResultado(c.resultado), fontStyle: "bold", halign: "right" },
        },
      ]),
      foot: [
        "TOTAL",
        der(formatMiles(Number(t.ingresos) || 0)),
        manual(Number(t.ingresosManuales) || 0),
        der(formatMiles(Number(t.retiros) || 0)),
        der(formatMiles(Number(t.salarios) || 0)),
        {
          content: formatMiles(Number(t.resultado) || 0),
          styles: { textColor: colorResultado(Number(t.resultado) || 0), halign: "right" },
        },
      ],
      fontSize: 8,
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  }

  // Detalle por colegio: conceptos de cada rubro con su subtotal
  const fila = (
    texto: string,
    cant: string | number,
    total: string,
    estilo: Partial<Styles> = {}
  ): RowInput => [
    { content: texto, styles: estilo },
    { content: cant, styles: estilo },
    { content: total, styles: estilo },
  ];

  const rubro = (nombre: string, signo: string, conceptos: ConceptoResultado[], total: number) => {
    const usados = conceptos.filter((k) => k.CantMovimientos > 0);
    return [
      fila(`${signo} ${nombre}`, "", "", { fontStyle: "bold", fillColor: PDF_COLORS.totalFill }),
      ...(usados.length
        ? usados.map((k) =>
            fila(
              `    ${k.GrupoDescripcion}`,
              k.CantMovimientos,
              formatMiles(k.Total),
              k.Manual ? { textColor: COLOR_MANUAL, fontStyle: "italic" } : {}
            )
          )
        : [fila("    Sin movimientos", "", "")]),
      fila(`Total ${nombre.toLowerCase()}`, "", formatMiles(total), { fontStyle: "bold" }),
    ];
  };

  conMovimientos.forEach((c) => {
    y = pdfSeccion(doc, y, c.ColegioNombre, {
      head: ["Concepto", centro("Movimientos"), der("Total Gs.")],
      body: [
        ...rubro("INGRESOS", "(+)", c.ingresos, c.totalIngresos),
        ...rubro("RETIROS", "(-)", c.retiros, c.totalRetiros),
        ...rubro("SALARIOS", "(-)", c.salarios, c.totalSalarios),
      ],
      foot: [
        "RESULTADO",
        "",
        {
          content: formatMiles(c.resultado),
          styles: { textColor: colorResultado(c.resultado), halign: "right" },
        },
      ],
      fontSize: 9,
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    });
  });

  if (colegioId) {
    const c = conMovimientos[0];
    pdfCuadroControl(
      doc,
      y,
      [
        ["INGRESOS", formatMiles(c.totalIngresos)],
        ["(-) RETIROS", formatMiles(c.totalRetiros)],
        ["(-) SALARIOS", formatMiles(c.totalSalarios)],
        ["RESULTADO", formatMiles(c.resultado)],
      ],
      { fila: 3, color: colorResultado(c.resultado) }
    );
    y = getLastY(doc) + 10;
  }

  y = pdfNota(
    doc,
    y,
    "Todas las cajas. Salarios incluye los anticipos de salario de profesores."
  );
  y = pdfNota(
    doc,
    y,
    "\"Cargados a mano en caja\": ingresos al concepto del colegio que no salen de la pantalla de cobranzas."
  );
  if (!colegioId) {
    pdfNota(doc, y, "Los colegios sin movimientos en el período figuran solo en el resumen.");
  }

  pdfFooter(doc);
  abrirPdf(doc, "estado-resultados-colegios.pdf");
}

// ── Vista mes por mes ──

interface ResultadoMes {
  ingresos: number;
  ingresosManuales: number;
  retiros: number;
  salarios: number;
  resultado: number;
}

interface ColegioResultadoMensual {
  ColegioId: number;
  ColegioNombre: string;
  porMes: Record<string, ResultadoMes>;
  total: ResultadoMes;
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// "2026-07" -> "Jul 2026"
const etiquetaMes = (mes: string) => {
  const [a, m] = mes.split("-");
  return `${MESES_CORTOS[Number(m) - 1]} ${a}`;
};

const celdaResultado = (n: number) => ({
  content: formatMiles(n),
  styles: { textColor: colorResultado(n), fontStyle: "bold" as const, halign: "right" as const },
});

export async function generarEstadoResultadosColegiosMensual(
  desde: string,
  hasta: string,
  colegioId: string
) {
  validarRango(desde, hasta);
  const r = await getReporteEstadoResultadosMensual(desde, hasta, colegioId);
  const meses = (r.meses || []) as string[];
  const colegios = (r.colegios || []) as ColegioResultadoMensual[];
  if (!colegios.length) {
    throw new SinDatosError("No hay movimientos de colegios en el periodo seleccionado");
  }

  const doc = new jsPDF("landscape");
  const titulo = colegioId ? "Resultados mes a mes" : "Resultados mes a mes - Colegios";
  let y = pdfHeader(doc, titulo, desde, hasta);

  const head = ["", ...[...meses.map(etiquetaMes), "Total"].map(der)];
  const columnasNumericas = Object.fromEntries(
    head.slice(1).map((_, i) => [i + 1, { halign: "right" as const }])
  );

  // Resumen: resultado de cada colegio por mes (solo con más de un colegio)
  if (!colegioId) {
    const t = r.totales as { porMes: Record<string, ResultadoMes>; total: ResultadoMes };
    y = pdfSeccion(doc, y, "RESULTADO POR COLEGIO", {
      head: ["Colegio", ...head.slice(1)],
      body: colegios.map((c) => [
        c.ColegioNombre,
        ...meses.map((m) => celdaResultado(c.porMes[m].resultado)),
        celdaResultado(c.total.resultado),
      ]),
      foot: [
        "TOTAL",
        ...meses.map((m) => celdaResultado(t.porMes[m].resultado)),
        celdaResultado(t.total.resultado),
      ],
      fontSize: 7,
      columnStyles: columnasNumericas,
    });
  }

  // Detalle de cada colegio: rubros por mes
  colegios.forEach((c) => {
    const fila = (
      texto: string,
      valor: (v: ResultadoMes) => number,
      estilo: Partial<Styles> = {}
    ): RowInput => [
      { content: texto, styles: estilo },
      ...[...meses.map((m) => c.porMes[m]), c.total].map((v) => ({
        content: formatMiles(valor(v)),
        styles: estilo,
      })),
    ];
    y = pdfSeccion(doc, y, c.ColegioNombre, {
      head,
      body: [
        fila("(+) Ingresos", (v) => v.ingresos),
        fila("    de ellos cargados a mano", (v) => v.ingresosManuales, {
          textColor: COLOR_MANUAL,
          fontStyle: "italic",
        }),
        fila("(-) Retiros", (v) => v.retiros),
        fila("(-) Salarios", (v) => v.salarios),
      ],
      foot: [
        "RESULTADO",
        ...[...meses.map((m) => c.porMes[m]), c.total].map((v) =>
          celdaResultado(v.resultado)
        ),
      ],
      fontSize: 7,
      columnStyles: { 0: { cellWidth: 42 }, ...columnasNumericas },
    });
  });

  y = pdfNota(
    doc,
    y,
    "Todas las cajas. Cada movimiento cuenta en el mes de su fecha en caja. Salarios incluye los anticipos de salario."
  );
  pdfNota(
    doc,
    y,
    "\"Cargados a mano\": ingresos al concepto del colegio que no salen de la pantalla de cobranzas (ya incluidos en Ingresos)."
  );

  pdfFooter(doc);
  abrirPdf(doc, "estado-resultados-colegios-mensual.pdf");
}
