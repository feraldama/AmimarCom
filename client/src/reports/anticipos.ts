import { jsPDF } from "jspdf";
import { getReporteAnticipos } from "../services/registros.service";
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

interface AnticipoMovimiento {
  RegistroDiarioCajaId: number;
  Tipo: "INGRESO" | "EGRESO";
  GrupoDescripcion: string;
  Detalle: string;
  Fecha: string;
  Monto: number;
  Cambio: number;
  MontoUsd: number;
  CajaDescripcion: string;
  UsuarioId: string;
  UsuarioNombre: string;
}

export async function generarAnticipos(desde: string, hasta: string, grupo: string) {
  validarRango(desde, hasta);
  const r = await getReporteAnticipos(desde, hasta, grupo);
  const movimientos = (r.movimientos || []) as AnticipoMovimiento[];
  if (!movimientos.length) {
    throw new SinDatosError("No hay movimientos del grupo en el periodo seleccionado");
  }

  const doc = new jsPDF("landscape");
  const y0 = pdfHeader(doc, `Anticipos - ${grupo}`, desde, hasta);

  const y = pdfSeccion(doc, y0, "", {
    head: ["Registro", "Tipo", "Detalle", "Fecha", "Egreso Gs.", "Ingreso Gs.", "Cotización", "Monto U$D", "Usuario"],
    body: movimientos.map((m) => [
      m.RegistroDiarioCajaId,
      m.Tipo,
      m.Detalle,
      fmtFechaHora(m.Fecha),
      m.Tipo === "EGRESO" ? formatMiles(Number(m.Monto)) : "",
      m.Tipo === "INGRESO" ? formatMiles(Number(m.Monto)) : "",
      Number(m.Cambio) > 0 ? formatMilesSmart(Number(m.Cambio)) : "",
      Number(m.Cambio) > 0 ? formatMilesSmart(Number(m.MontoUsd)) : "",
      m.UsuarioNombre || m.UsuarioId || "",
    ]),
    foot: ["TOTAL", "", "", "",
      formatMiles(Number(r.totalEgresos)),
      formatMiles(Number(r.totalIngresos)),
      "",
      formatMilesSmart(Number(r.totalEgresosUsd) + Number(r.totalIngresosUsd)),
      "",
    ],
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    tipoColIndex: 1,
  });

  pdfCuadroControl(doc, y, [
    ["TOTAL EGRESO U$D", formatMilesSmart(Number(r.totalEgresosUsd))],
    ["TOTAL INGRESO U$D", formatMilesSmart(Number(r.totalIngresosUsd))],
    ["PROMEDIO COTIZACIÓN", formatMilesSmart(Number(r.promedioCotizacion))],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "anticipos.pdf");
}
