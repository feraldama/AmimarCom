import { jsPDF } from "jspdf";
import { getReporteEmpresaTransporte } from "../services/pagotrans.service";
import { formatMiles, formatMilesSmart } from "../utils/utils";
import {
  pdfHeader,
  pdfFiltroCajas,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  abrirPdf,
  fmtFechaHora,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";
import type { CajaFiltro } from "./types";

interface PagoTransporte {
  PagoTransId: number;
  NumeroBoleto: string;
  Fecha: string;
  Pasajero: string;
  Origen: string;
  Destino: string;
  Monto: number;
  Liquidacion: number;
  UsuarioId: string;
  UsuarioNombre: string;
}

export async function generarEmpresaTransporte(
  desde: string,
  hasta: string,
  transporteId: string | number,
  transporteNombre: string,
  cajasFiltro: CajaFiltro[] = []
) {
  validarRango(desde, hasta);
  const r = await getReporteEmpresaTransporte(
    desde,
    hasta,
    transporteId,
    cajasFiltro.map((c) => c.id)
  );
  const data = (r.data || []) as PagoTransporte[];
  if (!data.length) {
    throw new SinDatosError("No hay ventas de pasajes de la empresa en el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y0 = pdfHeader(
    doc,
    `Empresa de Transporte - ${transporteNombre || r.transporteNombre || ""}`.trim(),
    desde,
    hasta
  );
  y0 = pdfFiltroCajas(doc, y0, cajasFiltro.map((c) => c.desc));

  const y = pdfSeccion(doc, y0, "", {
    head: ["N° Boleto", "Fecha Venta", "Pasajero", "Monto Gs.", "Liquidación Gs.", "Usuario"],
    body: data.map((p) => [
      p.NumeroBoleto,
      fmtFechaHora(p.Fecha),
      p.Pasajero,
      formatMiles(p.Monto),
      formatMiles(p.Liquidacion),
      p.UsuarioNombre || p.UsuarioId || "",
    ]),
    foot: [
      { content: `TOTALES (${data.length} boletos)`, colSpan: 3, styles: { halign: "right" } },
      formatMiles(Number(r.totalMonto) || 0),
      formatMiles(Number(r.totalLiquidacion) || 0),
      "",
    ],
    fontSize: 9,
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  const comisionPct = Number(r.comisionPct) || 0;
  pdfCuadroControl(doc, y, [
    ["MONTO VENDIDO", formatMiles(Number(r.totalMonto) || 0)],
    ["LIQUIDACIÓN", formatMiles(Number(r.totalLiquidacion) || 0)],
    [`COMISIÓN (${formatMilesSmart(comisionPct)}%)`, formatMiles(Number(r.totalComision) || 0)],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "empresa-transporte.pdf");
}
