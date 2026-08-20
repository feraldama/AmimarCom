import { jsPDF } from "jspdf";
import { getReporteCobranzaColegio } from "../services/colegiocobranza.service";
import { formatMiles, formatMilesSmart } from "../utils/utils";
import {
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  abrirPdf,
  fmtFechaHora,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";

interface CobranzaColegio {
  ColegioCobranzaId: number;
  CursoNombre: string;
  Apellido: string;
  Nombre: string;
  Fecha: string;
  MesPagado: string;
  Importe: number;
  Meses: number;
  Subtotal: number;
  DiasMora: number;
  Multa: number;
  Examen: number;
  Descuento: number;
  Total: number;
  Comision: number;
  UsuarioNombre: string;
}

export async function generarCobranzaColegios(
  desde: string,
  hasta: string,
  colegioId: string | number,
  colegioNombre: string
) {
  validarRango(desde, hasta);
  const r = await getReporteCobranzaColegio(desde, hasta, colegioId);
  const data = (r.data || []) as CobranzaColegio[];
  if (!data.length) {
    throw new SinDatosError("No hay cobranzas del colegio en el periodo seleccionado");
  }

  // Agrupar por curso preservando el orden del backend (curso, alumno, fecha)
  const porCurso = new Map<string, CobranzaColegio[]>();
  data.forEach((c) => {
    if (!porCurso.has(c.CursoNombre)) porCurso.set(c.CursoNombre, []);
    porCurso.get(c.CursoNombre)!.push(c);
  });

  const doc = new jsPDF("landscape");
  let y = pdfHeader(doc, `Cobranza - ${colegioNombre || r.colegioNombre || "Colegio"}`, desde, hasta);

  porCurso.forEach((rows, curso) => {
    const sum = (fn: (c: CobranzaColegio) => number) =>
      rows.reduce((s, c) => s + fn(c), 0);

    y = pdfSeccion(doc, y, curso, {
      head: ["Apellidos", "Nombres", "Fecha", "Mes Pagado", "Importe", "Mes", "Subtotal", "Días", "Multa", "Examen", "Descuento", "Total", "Comisión"],
      body: rows.map((c) => [
        c.Apellido,
        c.Nombre,
        fmtFechaHora(c.Fecha),
        c.MesPagado,
        formatMiles(c.Importe),
        c.Meses,
        formatMiles(c.Subtotal),
        c.DiasMora || "",
        c.Multa ? formatMiles(c.Multa) : "",
        c.Examen ? formatMiles(c.Examen) : "",
        c.Descuento ? formatMiles(c.Descuento) : "",
        formatMiles(c.Total),
        c.Comision ? formatMilesSmart(c.Comision) : "",
      ]),
      foot: [
        { content: `TOTAL (${rows.length} cobranzas)`, colSpan: 6, styles: { halign: "right" } },
        formatMiles(sum((c) => c.Subtotal)),
        "",
        formatMiles(sum((c) => c.Multa)),
        formatMiles(sum((c) => c.Examen)),
        formatMiles(sum((c) => c.Descuento)),
        formatMiles(sum((c) => c.Total)),
        formatMilesSmart(sum((c) => c.Comision)),
      ],
      fontSize: 7,
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "center" },
        6: { halign: "right" },
        7: { halign: "center" },
        8: { halign: "right" },
        9: { halign: "right" },
        10: { halign: "right" },
        11: { halign: "right" },
        12: { halign: "right" },
      },
    });
  });

  const totales = r.totales || {};
  const comisionPct = Number(r.comisionPct) || 0;
  pdfCuadroControl(doc, y, [
    ["SUBTOTAL CUOTAS", formatMiles(Number(totales.Subtotal) || 0)],
    ["MULTAS", formatMiles(Number(totales.Multa) || 0)],
    ["EXÁMENES", formatMiles(Number(totales.Examen) || 0)],
    ["DESCUENTOS", formatMiles(Number(totales.Descuento) || 0)],
    ["TOTAL GENERAL", formatMiles(Number(totales.Total) || 0)],
    [`COMISIÓN (${formatMilesSmart(comisionPct)}%)`, formatMilesSmart(Number(totales.Comision) || 0)],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "cobranza-colegios.pdf");
}
