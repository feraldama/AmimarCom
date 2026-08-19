import { jsPDF } from "jspdf";
import { getReporteJSICobros } from "../services/jsicobro.service";
import { formatMiles } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  abrirPdf,
  asegurarEspacio,
  fmtFecha,
  fmtFechaHora,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";
import { formatMilesSmart } from "../utils/utils";

interface JSICobro {
  JSICobroId: number;
  Fecha: string;
  ClienteId: number;
  ClienteNombre: string;
  Monto: number;
  UsuarioId: string;
  UsuarioNombre: string;
}

interface JSIResumenDia {
  Fecha: string;
  Monto: number;
  Comision: number;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function generarJSI(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const r = await getReporteJSICobros(desde, hasta);
  const data = (r.data || []) as JSICobro[];
  if (!data.length) {
    throw new SinDatosError("No hay cobros JSI en el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y = pdfHeader(doc, "Junta de Saneamiento de Itauguá", desde, hasta);

  // Campos de la rendición que se completan a mano al entregar el reporte
  const campos = [
    "FECHA DE COBRO:",
    "FECHA DE DEPÓSITO:",
    "NRO. DE BOLETA DE DEP.:",
    "NRO. DE CUENTA:",
  ];
  doc.setFontSize(10);
  campos.forEach((label) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(70, y + 1, 140, y + 1);
    y += 8;
  });
  y += 4;

  y = pdfSeccion(doc, y, "", {
    head: ["N°", "Fecha", "Código", "Nombre y Apellido", "Total Gs.", "Usuario"],
    body: data.map((c, i) => [
      i + 1,
      fmtFechaHora(c.Fecha),
      c.ClienteId ?? "",
      c.ClienteNombre,
      formatMiles(c.Monto),
      c.UsuarioNombre || c.UsuarioId || "",
    ]),
    foot: [`TOTALES (${data.length} cobros)`, "", "", "", formatMiles(Number(r.total) || 0), ""],
    fontSize: 9,
    columnStyles: { 0: { halign: "center" }, 4: { halign: "right" } },
  });

  // Firma de quien retira la rendición
  y = asegurarEspacio(doc, y + 10, 30);
  doc.setFontSize(10);
  doc.text("Retirado por:", 14, y);
  doc.setDrawColor(...PDF_COLORS.line);
  doc.line(42, y + 1, 130, y + 1);
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text("Firma y aclaración", 86, y + 5, { align: "center" });
  doc.setTextColor(...PDF_COLORS.textDark);

  // Resumen por día en hoja aparte, con la comisión de la Junta
  const resumen = (r.resumen || []) as JSIResumenDia[];
  if (resumen.length) {
    const comisionPct = Number(r.comisionPct) || 0;
    const [anioD, mesD] = desde.split("-");
    const [anioH, mesH] = hasta.split("-");
    const tituloResumen =
      anioD === anioH && mesD === mesH
        ? `Resumen del mes de ${MESES[Number(mesD) - 1]} de ${anioD}`
        : "Resumen por día del período";

    doc.addPage();
    pdfSeccion(doc, 20, tituloResumen, {
      head: ["Monto Gs.", "Fecha", "N° de Boleta", "Subtotal Gs.", `Comisión (${formatMilesSmart(comisionPct)}%)`],
      body: resumen.map((d) => [
        formatMiles(d.Monto),
        fmtFecha(d.Fecha),
        "",
        formatMiles(d.Monto),
        formatMilesSmart(d.Comision),
      ]),
      foot: [
        formatMiles(resumen.reduce((s, d) => s + d.Monto, 0)),
        `TOTAL (${resumen.length} días)`,
        "",
        formatMiles(resumen.reduce((s, d) => s + d.Monto, 0)),
        formatMilesSmart(resumen.reduce((s, d) => s + d.Comision, 0)),
      ],
      fontSize: 9,
      columnStyles: {
        0: { halign: "right" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });
  }

  pdfFooter(doc);
  abrirPdf(doc, "jsi-cobranza.pdf");
}
