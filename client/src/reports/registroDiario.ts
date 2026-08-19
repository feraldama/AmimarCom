import { jsPDF } from "jspdf";
import { getReporteMovimientosCajas } from "../services/registros.service";
import { formatMiles } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  abrirPdf,
  asegurarEspacio,
  fmtFechaHora,
  SinDatosError,
  validarRango,
} from "../utils/pdfReport";
import type { RegistroCaja } from "./types";

async function generar(
  desde: string,
  hasta: string,
  titulo: string,
  archivo: string,
  cajaId?: string | number
) {
  validarRango(desde, hasta);
  const response = await getReporteMovimientosCajas(desde, hasta, cajaId);
  const movimientos = (response.data || []) as RegistroCaja[];
  if (!movimientos.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  // Agrupar por caja preservando el orden cronológico (vienen por Id ASC)
  const porCaja = new Map<number, { desc: string; regs: RegistroCaja[] }>();
  movimientos.forEach((m) => {
    if (!porCaja.has(m.CajaId)) {
      porCaja.set(m.CajaId, { desc: (m.CajaDescripcion || `Caja ${m.CajaId}`).trim(), regs: [] });
    }
    porCaja.get(m.CajaId)!.regs.push(m);
  });

  const doc = new jsPDF("landscape");
  let y = pdfHeader(doc, titulo, desde, hasta);

  porCaja.forEach(({ desc, regs }) => {
    y = pdfSeccion(doc, y, desc, {
      head: ["Registro", "Tipo", "Grupo", "Detalle", "Fecha", "Monto Gs.", "Usuario"],
      body: regs.map((r) => [
        r.RegistroDiarioCajaId,
        r.TipoGastoId === 2 ? "INGRESO" : "EGRESO",
        (r.TipoGastoGrupoDescripcion || "").trim(),
        r.RegistroDiarioCajaDetalle || "",
        fmtFechaHora(r.RegistroDiarioCajaFecha),
        formatMiles(Number(r.RegistroDiarioCajaMonto)),
        (r.UsuarioNombre || r.UsuarioId || "").trim(),
      ]),
      columnStyles: { 5: { halign: "right" } },
      tipoColIndex: 1,
    });
    y -= 6; // el resumen va pegado a la tabla

    // Control apertura/cierre: misma fórmula que el ticket de cierre de caja.
    // Apertura = TipoGasto 2 / Grupo 2, Cierre = TipoGasto 1 / Grupo 2.
    let apertura = 0, cierre = 0, ingresos = 0, egresos = 0, cantCierres = 0;
    regs.forEach((r) => {
      const monto = Number(r.RegistroDiarioCajaMonto) || 0;
      if (r.TipoGastoId === 2) {
        if (r.TipoGastoGrupoId === 2) apertura += monto; else ingresos += monto;
      } else if (r.TipoGastoId === 1) {
        if (r.TipoGastoGrupoId === 2) { cierre += monto; cantCierres += 1; }
        else egresos += monto;
      }
    });

    y = asegurarEspacio(doc, y, 25);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(
      `Apertura: Gs. ${formatMiles(apertura)}    Ingresos: Gs. ${formatMiles(ingresos)}    Egresos: Gs. ${formatMiles(egresos)}    Cierre: Gs. ${formatMiles(cierre)}`,
      14, y
    );
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    if (cantCierres === 0) {
      // Sin cierre en el rango la fórmula no aplica: mostrar el saldo teórico
      // en tono neutro en lugar de un "faltante" falso.
      doc.setTextColor(...PDF_COLORS.textMuted);
      doc.text(
        `Caja sin cierre en el período - saldo teórico: Gs. ${formatMiles(apertura + ingresos - egresos)}`,
        14, y
      );
    } else {
      const sf = ingresos + apertura - (cierre + egresos);
      const txtSf = sf > 0
        ? `Faltante de: Gs. ${formatMiles(sf)}`
        : sf < 0
          ? `Sobrante de: Gs. ${formatMiles(Math.abs(sf))}`
          : "Sobrante/Faltante: 0";
      doc.setTextColor(...(sf === 0 ? PDF_COLORS.ingreso : PDF_COLORS.egreso));
      doc.text(txtSf, 14, y);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textDark);
    y += 12;
  });

  pdfFooter(doc);
  abrirPdf(doc, archivo);
}

/** Todos los movimientos de todas las cajas tipo 1, con control de cierre. */
export const generarRegistroDiario = (desde: string, hasta: string) =>
  generar(desde, hasta, "Registro Diario - Apertura/Cierre", "registro-diario.pdf");

/** Igual que Registro Diario pero filtrado a una sola caja. */
export const generarIngresoEgresoPorCaja = (
  desde: string,
  hasta: string,
  cajaId: string | number
) => generar(desde, hasta, "Ingreso/Egreso por Caja", "ingreso-egreso-por-caja.pdf", cajaId);
