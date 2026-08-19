import { jsPDF } from "jspdf";
import { getReportePaseCajas } from "../services/registros.service";
import { formatMiles } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  abrirPdf,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";

interface PaseMovimiento {
  RegistroDiarioCajaId: number;
  Tipo: "INGRESO" | "EGRESO";
  GrupoDescripcion: string;
  Fecha: string;
  Monto: number;
  UsuarioId: string;
  UsuarioNombre: string;
  Detalle: string;
}

interface ReportePaseCaja {
  CajaId: number;
  CajaDescripcion: string;
  pases: PaseMovimiento[];
}

export async function generarPaseCajas(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const response = await getReportePaseCajas(desde, hasta);
  const data = (response.data || []) as ReportePaseCaja[];
  if (!data.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y = pdfHeader(doc, "Pase de Cajas", desde, hasta);

  data.forEach((caja) => {
    y = pdfSeccion(doc, y, caja.CajaDescripcion, {
      head: ["Tipo", "Concepto", "Fecha", "Usuario", "Monto Gs."],
      body: caja.pases.map((p) => [
        p.Tipo,
        p.GrupoDescripcion,
        new Date(p.Fecha).toLocaleDateString("es-PY"),
        p.UsuarioNombre || p.UsuarioId || "",
        formatMiles(Number(p.Monto)),
      ]),
      fontSize: 9,
      columnStyles: { 4: { halign: "right" } },
      tipoColIndex: 0,
    }, "Sin pases en el período");
  });

  // Cuadro de control: los pases deben quedar balanceados (diferencia 0)
  const diferencia = Number(response.diferencia) || 0;
  pdfCuadroControl(doc, y, [
    ["EGRESOS", formatMiles(Number(response.totalEgresos))],
    ["INGRESOS", formatMiles(Number(response.totalIngresos))],
    ["DIFERENCIA", formatMiles(diferencia)],
  ], { fila: 2, color: diferencia === 0 ? PDF_COLORS.ingreso : PDF_COLORS.egreso });

  pdfFooter(doc);
  abrirPdf(doc, "pase-de-cajas.pdf");
}
