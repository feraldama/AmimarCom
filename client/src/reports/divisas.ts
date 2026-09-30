import { jsPDF } from "jspdf";
import { getReporteDivisas } from "../services/registros.service";
import { formatMilesSmart } from "../utils/utils";
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
import type { CajaFiltro } from "./types";

interface DivisaResumen {
  DivisaNombre: string;
  CantCompra: number;
  MontoCompra: number;
  CantVenta: number;
  MontoVenta: number;
  CantOperaciones: number;
}

interface DivisaMovimiento {
  DivisaMovimientoId: number;
  DivisaMovimientoFecha: string;
  DivisaNombre: string;
  DivisaMovimientoTipo: string;
  DivisaMovimientoCambio: number;
  DivisaMovimientoCantidad: number;
  DivisaMovimientoMonto: number;
  UsuarioNombre: string;
  CajaId: number;
  CajaDescripcion: string;
}

export async function generarDivisas(
  desde: string,
  hasta: string,
  cajasFiltro: CajaFiltro[] = []
) {
  validarRango(desde, hasta);
  const response = await getReporteDivisas(
    desde,
    hasta,
    cajasFiltro.map((c) => c.id)
  );
  const resumen = (response.resumen || []) as DivisaResumen[];
  const data = (response.data || []) as DivisaMovimiento[];
  if (!data.length) {
    throw new SinDatosError("No hay movimientos de divisas para el periodo seleccionado");
  }

  const doc = new jsPDF("landscape");
  let y = pdfHeader(doc, "Historial de Cambio de Divisas", desde, hasta);
  y = pdfFiltroCajas(doc, y, cajasFiltro.map((c) => c.desc));

  if (resumen.length) {
    y = pdfSeccion(doc, y, "Resumen por Divisa", {
      head: ["Divisa", "Compras (Cant.)", "Compras (Gs.)", "Ventas (Cant.)", "Ventas (Gs.)", "Operaciones"],
      body: resumen.map((r) => [
        (r.DivisaNombre || "").trim(),
        formatMilesSmart(Number(r.CantCompra)),
        formatMilesSmart(Number(r.MontoCompra)),
        formatMilesSmart(Number(r.CantVenta)),
        formatMilesSmart(Number(r.MontoVenta)),
        r.CantOperaciones,
      ]),
      fontSize: 9,
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "center" },
      },
    });
  }

  // Agrupar el detalle por caja
  const porCaja = new Map<
    number,
    { desc: string; regs: DivisaMovimiento[]; tCompra: number; tVenta: number }
  >();
  data.forEach((r) => {
    if (!porCaja.has(r.CajaId)) {
      porCaja.set(r.CajaId, {
        desc: (r.CajaDescripcion || `Caja ${r.CajaId}`).trim(),
        regs: [],
        tCompra: 0,
        tVenta: 0,
      });
    }
    const caja = porCaja.get(r.CajaId)!;
    caja.regs.push(r);
    const monto = Number(r.DivisaMovimientoMonto) || 0;
    if (r.DivisaMovimientoTipo === "C") caja.tCompra += monto;
    else caja.tVenta += monto;
  });

  porCaja.forEach(({ desc, regs, tCompra, tVenta }) => {
    y = pdfSeccion(doc, y, `Detalle de Operaciones - ${desc}`, {
      head: ["ID", "Fecha", "Divisa", "Tipo", "Cambio", "Cantidad", "Monto Gs.", "Usuario"],
      body: regs.map((r) => [
        r.DivisaMovimientoId,
        new Date(r.DivisaMovimientoFecha).toLocaleDateString("es-PY"),
        (r.DivisaNombre || "").trim(),
        r.DivisaMovimientoTipo === "C" ? "Compra" : "Venta",
        formatMilesSmart(Number(r.DivisaMovimientoCambio)),
        formatMilesSmart(Number(r.DivisaMovimientoCantidad)),
        formatMilesSmart(Number(r.DivisaMovimientoMonto)),
        (r.UsuarioNombre || "").trim(),
      ]),
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });
    y -= 6;

    y = asegurarEspacio(doc, y, 20);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(
      `Compras: Gs. ${formatMilesSmart(tCompra)}  |  Ventas: Gs. ${formatMilesSmart(tVenta)}  |  Operaciones: ${regs.length}`,
      14, y
    );
    doc.setTextColor(...PDF_COLORS.textDark);
    y += 12;
  });

  pdfFooter(doc);
  abrirPdf(doc, "historial-divisas.pdf");
}
