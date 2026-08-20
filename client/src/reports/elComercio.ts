import { jsPDF } from "jspdf";
import { getReporteElComercio } from "../services/registros.service";
import { formatMiles, formatMilesSmart } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  abrirPdf,
  SinDatosError,
  validarRango,
  type RGB,
} from "../utils/pdfReport";

interface GrupoComercio {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  GrupoDescripcion: string;
  Total: number;
  TotalUsd: number;
  CantMovimientos: number;
}

export async function generarElComercio(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const r = await getReporteElComercio(desde, hasta);
  const egresos = (r.egresos || []) as GrupoComercio[];
  const ingresos = (r.ingresos || []) as GrupoComercio[];
  if (!egresos.length && !ingresos.length) {
    throw new SinDatosError("No hay movimientos de El Comercio en el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y = pdfHeader(doc, "El Comercio - Ingresos/Egresos", desde, hasta);

  const seccion = (titulo: string, rows: GrupoComercio[], totalGs: number, totalUsd: number, color: RGB) =>
    pdfSeccion(doc, y, titulo, {
      head: ["Concepto", "Movimientos", "Total Gs.", "Total U$D"],
      body: rows.map((g) => [
        g.GrupoDescripcion,
        g.CantMovimientos,
        formatMiles(Number(g.Total)),
        Number(g.TotalUsd) > 0 ? formatMilesSmart(Number(g.TotalUsd)) : "",
      ]),
      foot: [
        `TOTAL ${titulo}`,
        rows.reduce((s, g) => s + Number(g.CantMovimientos), 0),
        formatMiles(totalGs),
        totalUsd > 0 ? formatMilesSmart(totalUsd) : "",
      ],
      headColor: color,
      fontSize: 9,
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });

  y = seccion("EGRESOS", egresos, Number(r.totalEgresos), Number(r.totalEgresosUsd), PDF_COLORS.egreso);
  y = seccion("INGRESOS", ingresos, Number(r.totalIngresos), Number(r.totalIngresosUsd), PDF_COLORS.ingreso);

  pdfCuadroControl(doc, y, [
    ["EGRESOS", formatMiles(Number(r.totalEgresos))],
    ["INGRESOS", formatMiles(Number(r.totalIngresos))],
    ["SALDO", formatMiles(Number(r.totalIngresos) - Number(r.totalEgresos))],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "el-comercio.pdf");
}
