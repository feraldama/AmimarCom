import { jsPDF } from "jspdf";
import { getReporteMovimientosCajas } from "../services/registros.service";
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
} from "../utils/pdfReport";
import type { RegistroCaja, CajaFiltro } from "./types";

// cajasFiltro: cajas a incluir (vacío = todas). tipoGastoId: "1" egresos,
// "2" ingresos, "" ambos.
export async function generarMovimientosCajas(
  desde: string,
  hasta: string,
  cajasFiltro: CajaFiltro[] = [],
  tipoGastoId: string = ""
) {
  validarRango(desde, hasta);
  const response = await getReporteMovimientosCajas(
    desde,
    hasta,
    cajasFiltro.map((c) => c.id),
    tipoGastoId
  );
  const movimientos = (response.data || []) as RegistroCaja[];
  if (!movimientos.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  // Agrupar por caja
  const porCaja = new Map<number, { desc: string; regs: RegistroCaja[]; tIng: number; tEgr: number }>();
  movimientos.forEach((m) => {
    if (!porCaja.has(m.CajaId)) {
      porCaja.set(m.CajaId, { desc: (m.CajaDescripcion || `Caja ${m.CajaId}`).trim(), regs: [], tIng: 0, tEgr: 0 });
    }
    const caja = porCaja.get(m.CajaId)!;
    caja.regs.push(m);
    const monto = Number(m.RegistroDiarioCajaMonto) || 0;
    if (m.TipoGastoId === 2) caja.tIng += monto;
    else caja.tEgr += monto;
  });

  const titulo =
    tipoGastoId === "1"
      ? "Movimientos de Cajas - Egresos"
      : tipoGastoId === "2"
        ? "Movimientos de Cajas - Ingresos"
        : "Movimientos de Cajas";

  const doc = new jsPDF();
  let y = pdfHeader(doc, titulo, desde, hasta);
  y = pdfFiltroCajas(doc, y, cajasFiltro.map((c) => c.desc));

  porCaja.forEach(({ desc, regs, tIng, tEgr }) => {
    y = pdfSeccion(doc, y, desc, {
      head: ["ID", "Fecha", "Tipo", "Grupo", "Detalle", "Monto Gs."],
      body: regs.map((r) => [
        r.RegistroDiarioCajaId,
        new Date(r.RegistroDiarioCajaFecha).toLocaleDateString("es-PY"),
        r.TipoGastoId === 2 ? "INGRESO" : "EGRESO",
        (r.TipoGastoGrupoDescripcion || "").trim(),
        r.RegistroDiarioCajaDetalle || "",
        formatMiles(Number(r.RegistroDiarioCajaMonto)),
      ]),
      fontSize: 7,
      columnStyles: { 5: { halign: "right" } },
      tipoColIndex: 2,
    });
    y -= 6;

    y = asegurarEspacio(doc, y, 20);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(
      `Ingresos: Gs. ${formatMiles(tIng)}  |  Egresos: Gs. ${formatMiles(tEgr)}  |  Saldo: Gs. ${formatMiles(tIng - tEgr)}`,
      14, y
    );
    doc.setTextColor(...PDF_COLORS.textDark);
    y += 12;
  });

  pdfFooter(doc);
  abrirPdf(doc, "movimientos-cajas.pdf");
}
