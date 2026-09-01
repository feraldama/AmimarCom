import { jsPDF } from "jspdf";
import { getReporteIngresosEgresos } from "../services/registros.service";
import { formatMiles } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFiltroCajas,
  pdfFooter,
  pdfSeccion,
  abrirPdf,
  asegurarEspacio,
  SinDatosError,
  validarRango,
  type RGB,
} from "../utils/pdfReport";
import type { CajaFiltro } from "./types";

interface GrupoResumen {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  GrupoDescripcion: string;
  Total: number;
  CantMovimientos: number;
}

export async function generarIngresosEgresosResumen(
  desde: string,
  hasta: string,
  cajasFiltro: CajaFiltro[] = []
) {
  validarRango(desde, hasta);
  const r = await getReporteIngresosEgresos(
    desde,
    hasta,
    cajasFiltro.map((c) => c.id)
  );
  const egresos = (r.egresos || []) as GrupoResumen[];
  const ingresos = (r.ingresos || []) as GrupoResumen[];
  if (!egresos.length && !ingresos.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y = pdfHeader(doc, "Ingresos / Egresos - Resumen", desde, hasta);
  y = pdfFiltroCajas(doc, y, cajasFiltro.map((c) => c.desc));

  const seccion = (titulo: string, rows: GrupoResumen[], total: number, color: RGB) =>
    pdfSeccion(doc, y, titulo, {
      head: ["Concepto", "Movimientos", "Total Gs."],
      body: rows.map((g) => [g.GrupoDescripcion, g.CantMovimientos, formatMiles(Number(g.Total))]),
      foot: [
        `TOTAL ${titulo}`,
        rows.reduce((s, g) => s + Number(g.CantMovimientos), 0),
        formatMiles(total),
      ],
      headColor: color,
      fontSize: 9,
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    });

  y = seccion("EGRESOS", egresos, Number(r.totalEgresos), PDF_COLORS.egreso);
  y = seccion("INGRESOS", ingresos, Number(r.totalIngresos), PDF_COLORS.ingreso);

  y = asegurarEspacio(doc, y, 25);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`SALDO: Gs. ${formatMiles(Number(r.saldo))}`, 14, y);
  doc.setFont("helvetica", "normal");

  pdfFooter(doc);
  abrirPdf(doc, "ingresos-egresos-resumen.pdf");
}
