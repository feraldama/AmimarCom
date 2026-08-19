import { jsPDF } from "jspdf";
import { getReporteDivisas } from "../services/registros.service";
import { formatMilesSmart } from "../utils/utils";
import {
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  abrirPdf,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";

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
  CajaDescripcion: string;
}

export async function generarDivisas(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const response = await getReporteDivisas(desde, hasta);
  const resumen = (response.resumen || []) as DivisaResumen[];
  const data = (response.data || []) as DivisaMovimiento[];
  if (!data.length) {
    throw new SinDatosError("No hay movimientos de divisas para el periodo seleccionado");
  }

  const doc = new jsPDF("landscape");
  let y = pdfHeader(doc, "Historial de Cambio de Divisas", desde, hasta);

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

  pdfSeccion(doc, y, "Detalle de Operaciones", {
    head: ["ID", "Fecha", "Divisa", "Tipo", "Cambio", "Cantidad", "Monto Gs.", "Usuario", "Caja"],
    body: data.map((r) => [
      r.DivisaMovimientoId,
      new Date(r.DivisaMovimientoFecha).toLocaleDateString("es-PY"),
      (r.DivisaNombre || "").trim(),
      r.DivisaMovimientoTipo === "C" ? "Compra" : "Venta",
      formatMilesSmart(Number(r.DivisaMovimientoCambio)),
      formatMilesSmart(Number(r.DivisaMovimientoCantidad)),
      formatMilesSmart(Number(r.DivisaMovimientoMonto)),
      (r.UsuarioNombre || "").trim(),
      (r.CajaDescripcion || "").trim(),
    ]),
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  pdfFooter(doc);
  abrirPdf(doc, "historial-divisas.pdf");
}
