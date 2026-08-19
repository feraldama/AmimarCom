import { jsPDF } from "jspdf";
import { getReporteCierreDiario } from "../services/registros.service";
import { formatMiles } from "../utils/utils";
import {
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  abrirPdf,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";

interface CierreCaja {
  CajaDescripcion: string;
  TotalIngresos: number;
  TotalEgresos: number;
  Saldo: number;
  CantMovimientos: number;
}

export async function generarCierreDiario(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const response = await getReporteCierreDiario(desde, hasta);
  const data = (response.data || []) as CierreCaja[];
  if (!data.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  const totIng = data.reduce((s, r) => s + Number(r.TotalIngresos), 0);
  const totEgr = data.reduce((s, r) => s + Number(r.TotalEgresos), 0);

  const doc = new jsPDF();
  const y = pdfHeader(doc, "Cierre Diario de Caja", desde, hasta);

  pdfSeccion(doc, y, "", {
    head: ["Caja", "Ingresos Gs.", "Egresos Gs.", "Saldo Gs.", "Mov."],
    body: data.map((r) => [
      (r.CajaDescripcion || "").trim(),
      formatMiles(Number(r.TotalIngresos)),
      formatMiles(Number(r.TotalEgresos)),
      formatMiles(Number(r.Saldo)),
      r.CantMovimientos,
    ]),
    foot: ["TOTAL", formatMiles(totIng), formatMiles(totEgr), formatMiles(totIng - totEgr), ""],
    fontSize: 9,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "center" },
    },
  });

  pdfFooter(doc);
  abrirPdf(doc, "cierre-diario.pdf");
}
