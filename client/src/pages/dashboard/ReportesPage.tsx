import { BarChart3, FileText, Wallet, ArrowLeftRight, AlertTriangle } from "lucide-react";
import React, { useState } from "react";
import { usePermiso } from "../../hooks/usePermiso";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMiles, formatMilesSmart } from "../../utils/utils";
import {
  getReportePaseCajas,
  getReporteMovimientosCajas,
  getReporteCierreDiario,
  getReporteDivisas,
  getReporteIngresosEgresos,
  getReporteWestern,
} from "../../services/registros.service";
import { PDF_COLORS, pdfHeader, pdfFooter, abrirPdf, fmtFechaHora } from "../../utils/pdfReport";
import PageHeader from "../../components/common/PageHeader";
import { Button } from "@/components/ui/button";
import CampoFecha from "@/components/common/CampoFecha";

// ── Tipos ──

interface RegistroCaja {
  RegistroDiarioCajaId: number;
  CajaId: number;
  RegistroDiarioCajaFecha: string;
  RegistroDiarioCajaMonto: number;
  RegistroDiarioCajaDetalle: string;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  UsuarioId: string;
  UsuarioNombre?: string;
  CajaDescripcion: string;
  TipoGastoDescripcion: string;
  TipoGastoGrupoDescripcion: string;
}

interface GrupoResumen {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  GrupoDescripcion: string;
  Total: number;
  CantMovimientos: number;
}

interface WesternMovimiento {
  RegistroDiarioCajaId: number;
  GrupoDescripcion: string;
  Detalle: string;
  Fecha: string;
  Monto: number;
  Cambio: number;
  MTCN: number;
  CajaDescripcion: string;
  UsuarioId: string;
  UsuarioNombre: string;
}

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

// ── Componente ReportCard ──

interface ReportCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ReportCard({ title, description, icon, children }: ReportCardProps) {
  return (
    <div className="bg-white border border-border rounded-xl shadow-card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-50 flex-shrink-0">{icon}</div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Componente DateRange ──

interface DateRangeProps {
  fechaInicio: string;
  fechaFin: string;
  onChangeFechaInicio: (v: string) => void;
  onChangeFechaFin: (v: string) => void;
}

function DateRange({ fechaInicio, fechaFin, onChangeFechaInicio, onChangeFechaFin }: DateRangeProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
        <CampoFecha
          type="date"
          value={fechaInicio}
          onChange={(e) => onChangeFechaInicio(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
        <CampoFecha
          type="date"
          value={fechaFin}
          onChange={(e) => onChangeFechaFin(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Helpers ──

const fmt = (fecha: string) => {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

const getLastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

// ── Pagina principal ──

const ReportesPage: React.FC = () => {
  const puedeLeer = usePermiso("REPORTES", "leer");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  // Fechas por reporte
  const [f, setF] = useState({
    pase: [today, today],
    mov: [today, today],
    cierre: [today, today],
    divisas: [today, today],
    resumen: [today, today],
    registro: [today, today],
    westerngs: [today, today],
    westernusd: [today, today],
  });

  const updateF = (key: keyof typeof f, idx: 0 | 1, val: string) => {
    setF((prev) => {
      const arr = [...prev[key]];
      arr[idx] = val;
      return { ...prev, [key]: arr };
    });
  };

  if (!puedeLeer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="size-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver los reportes</p>
      </div>
    );
  }

  // ── Generadores de PDF ──

  const runReport = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el reporte");
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  // 0. Ingresos/Egresos Resumen
  const handleIngresosEgresos = () => runReport("resumen", async () => {
    const r = await getReporteIngresosEgresos(f.resumen[0], f.resumen[1]);
    const egresos = (r.egresos || []) as GrupoResumen[];
    const ingresos = (r.ingresos || []) as GrupoResumen[];
    if (!egresos.length && !ingresos.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const doc = new jsPDF();
    let y = pdfHeader(doc, "Ingresos / Egresos - Resumen", f.resumen[0], f.resumen[1]);

    const seccion = (titulo: string, rows: GrupoResumen[], total: number, color: [number, number, number]) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, 14, y);
      doc.setFont("helvetica", "normal");
      autoTable(doc, {
        head: [["Concepto", "Movimientos", "Total Gs."]],
        body: rows.map((g) => [g.GrupoDescripcion, g.CantMovimientos, formatMiles(Number(g.Total))]),
        foot: [[
          `TOTAL ${titulo}`,
          rows.reduce((s, g) => s + Number(g.CantMovimientos), 0),
          formatMiles(total),
        ]],
        startY: y + 3,
        theme: "striped",
        headStyles: { fillColor: color },
        footStyles: { fillColor: PDF_COLORS.totalFill, textColor: PDF_COLORS.textDark, fontStyle: "bold" },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
      y = getLastY(doc) + 12;
    };

    seccion("EGRESOS", egresos, Number(r.totalEgresos), PDF_COLORS.egreso);
    seccion("INGRESOS", ingresos, Number(r.totalIngresos), PDF_COLORS.ingreso);

    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`SALDO: Gs. ${formatMiles(Number(r.saldo))}`, 14, y);
    doc.setFont("helvetica", "normal");

    pdfFooter(doc);
    abrirPdf(doc);
  });

  // 0b. Registro Diario (apertura/cierre por caja con todos los movimientos)
  const handleRegistroDiario = () => runReport("registro", async () => {
    const response = await getReporteMovimientosCajas(f.registro[0], f.registro[1]);
    const movimientos = (response.data || []) as RegistroCaja[];
    if (!movimientos.length) { setError("No hay datos para el periodo seleccionado"); return; }

    // Agrupar por caja preservando el orden cronológico (vienen por Id ASC)
    const porCaja = new Map<number, { desc: string; regs: RegistroCaja[] }>();
    movimientos.forEach((m) => {
      if (!porCaja.has(m.CajaId)) porCaja.set(m.CajaId, { desc: (m.CajaDescripcion || `Caja ${m.CajaId}`).trim(), regs: [] });
      porCaja.get(m.CajaId)!.regs.push(m);
    });

    const doc = new jsPDF("landscape");
    let y = pdfHeader(doc, "Registro Diario - Apertura/Cierre", f.registro[0], f.registro[1]);

    porCaja.forEach(({ desc, regs }) => {
      if (y > 175) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(desc, 14, y);
      doc.setFont("helvetica", "normal");

      autoTable(doc, {
        head: [["Registro", "Tipo", "Grupo", "Detalle", "Fecha", "Monto Gs.", "Usuario"]],
        body: regs.map((r) => [
          r.RegistroDiarioCajaId,
          r.TipoGastoId === 2 ? "INGRESO" : "EGRESO",
          (r.TipoGastoGrupoDescripcion || "").trim(),
          r.RegistroDiarioCajaDetalle || "",
          fmtFechaHora(r.RegistroDiarioCajaFecha),
          formatMiles(Number(r.RegistroDiarioCajaMonto)),
          (r.UsuarioNombre || r.UsuarioId || "").trim(),
        ]),
        startY: y + 3,
        theme: "striped",
        headStyles: { fillColor: PDF_COLORS.primary },
        styles: { fontSize: 8 },
        columnStyles: { 5: { halign: "right" } },
        margin: { left: 14, right: 14 },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 1) {
            d.cell.styles.textColor =
              d.cell.raw === "INGRESO" ? PDF_COLORS.ingreso : PDF_COLORS.egreso;
            d.cell.styles.fontStyle = "bold";
          }
        },
      });
      y = getLastY(doc) + 6;

      // Control apertura/cierre: misma fórmula que el ticket de cierre de caja.
      // Apertura = TipoGasto 2 / Grupo 2, Cierre = TipoGasto 1 / Grupo 2.
      let apertura = 0, cierre = 0, ingresos = 0, egresos = 0;
      regs.forEach((r) => {
        const monto = Number(r.RegistroDiarioCajaMonto) || 0;
        if (r.TipoGastoId === 2) {
          if (r.TipoGastoGrupoId === 2) apertura += monto; else ingresos += monto;
        } else if (r.TipoGastoId === 1) {
          if (r.TipoGastoGrupoId === 2) cierre += monto; else egresos += monto;
        }
      });
      const sf = ingresos + apertura - (cierre + egresos);
      const txtSf = sf > 0
        ? `Faltante de: Gs. ${formatMiles(sf)}`
        : sf < 0
          ? `Sobrante de: Gs. ${formatMiles(Math.abs(sf))}`
          : "Sobrante/Faltante: 0";

      if (y > 185) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.textMuted);
      doc.text(
        `Apertura: Gs. ${formatMiles(apertura)}    Ingresos: Gs. ${formatMiles(ingresos)}    Egresos: Gs. ${formatMiles(egresos)}    Cierre: Gs. ${formatMiles(cierre)}`,
        14, y
      );
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(sf === 0 ? PDF_COLORS.ingreso : PDF_COLORS.egreso));
      doc.text(txtSf, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.textDark);
      y += 12;
    });

    pdfFooter(doc);
    abrirPdf(doc);
  });

  // 0c. Western Ingresos/Egresos (Gs.)
  const handleWesternGs = () => runReport("westerngs", async () => {
    const r = await getReporteWestern(f.westerngs[0], f.westerngs[1], "gs");
    const egresos = (r.egresos || []) as WesternMovimiento[];
    const ingresos = (r.ingresos || []) as WesternMovimiento[];
    if (!egresos.length && !ingresos.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const doc = new jsPDF();
    let y = pdfHeader(doc, "Western - Ingresos/Egresos (Gs.)", f.westerngs[0], f.westerngs[1]);

    const seccion = (titulo: string, rows: WesternMovimiento[], total: number, color: [number, number, number]) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, 14, y);
      doc.setFont("helvetica", "normal");
      if (rows.length) {
        autoTable(doc, {
          head: [["Registro", "Detalle", "Concepto", "Caja", "Usuario", "Monto Gs."]],
          body: rows.map((m) => [
            m.RegistroDiarioCajaId,
            m.Detalle,
            m.GrupoDescripcion,
            m.CajaDescripcion,
            m.UsuarioNombre || m.UsuarioId || "",
            formatMiles(Number(m.Monto)),
          ]),
          foot: [[`TOTAL ${titulo}`, "", "", "", "", formatMiles(total)]],
          startY: y + 3,
          theme: "striped",
          headStyles: { fillColor: color },
          footStyles: { fillColor: PDF_COLORS.totalFill, textColor: PDF_COLORS.textDark, fontStyle: "bold" },
          styles: { fontSize: 8 },
          columnStyles: { 5: { halign: "right" } },
          margin: { left: 14, right: 14 },
        });
        y = getLastY(doc) + 12;
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...PDF_COLORS.textMuted);
        doc.text("Sin movimientos en el período", 14, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PDF_COLORS.textDark);
        y += 16;
      }
    };

    seccion("EGRESOS", egresos, Number(r.totalEgresos), PDF_COLORS.egreso);
    seccion("INGRESOS", ingresos, Number(r.totalIngresos), PDF_COLORS.ingreso);

    // Cuadro final de control
    if (y > 240) { doc.addPage(); y = 20; }
    autoTable(doc, {
      body: [
        ["EGRESOS", formatMiles(Number(r.totalEgresos))],
        ["INGRESOS", formatMiles(Number(r.totalIngresos))],
        ["DIFERENCIA", formatMiles(Number(r.diferencia))],
      ],
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 10, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 110, right: 14 },
    });

    pdfFooter(doc);
    abrirPdf(doc);
  });

  // 0d. Western USD (grupos "2 WESTERN ..."; monto USD = Gs. / cotización)
  const handleWesternUsd = () => runReport("westernusd", async () => {
    const r = await getReporteWestern(f.westernusd[0], f.westernusd[1], "usd");
    const egresos = (r.egresos || []) as WesternMovimiento[];
    const ingresos = (r.ingresos || []) as WesternMovimiento[];
    if (!egresos.length && !ingresos.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const usd = (m: WesternMovimiento) =>
      Number(m.Cambio) > 0 ? Number(m.Monto) / Number(m.Cambio) : 0;
    const totalUsd = (rows: WesternMovimiento[]) =>
      rows.reduce((s, m) => s + usd(m), 0);

    const doc = new jsPDF("landscape");
    let y = pdfHeader(doc, "Western USD - Ingresos/Egresos", f.westernusd[0], f.westernusd[1]);

    const seccion = (titulo: string, rows: WesternMovimiento[], color: [number, number, number]) => {
      if (y > 175) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(titulo, 14, y);
      doc.setFont("helvetica", "normal");
      if (rows.length) {
        autoTable(doc, {
          head: [["Registro", "Detalle", "Concepto", "Caja", "Usuario", "Cotización", "Monto Gs.", "Monto U$D"]],
          body: rows.map((m) => [
            m.RegistroDiarioCajaId,
            m.Detalle,
            m.GrupoDescripcion,
            m.CajaDescripcion,
            m.UsuarioNombre || m.UsuarioId || "",
            formatMilesSmart(Number(m.Cambio)),
            formatMiles(Number(m.Monto)),
            formatMilesSmart(usd(m)),
          ]),
          foot: [[`TOTAL ${titulo}`, "", "", "", "", "",
            formatMiles(rows.reduce((s, m) => s + Number(m.Monto), 0)),
            formatMilesSmart(totalUsd(rows)),
          ]],
          startY: y + 3,
          theme: "striped",
          headStyles: { fillColor: color },
          footStyles: { fillColor: PDF_COLORS.totalFill, textColor: PDF_COLORS.textDark, fontStyle: "bold" },
          styles: { fontSize: 8 },
          columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
          margin: { left: 14, right: 14 },
        });
        y = getLastY(doc) + 12;
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...PDF_COLORS.textMuted);
        doc.text("Sin movimientos en el período", 14, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PDF_COLORS.textDark);
        y += 16;
      }
    };

    seccion("EGRESOS", egresos, PDF_COLORS.egreso);
    seccion("INGRESOS", ingresos, PDF_COLORS.ingreso);

    // Cuadro final de control, en dólares
    if (y > 165) { doc.addPage(); y = 20; }
    const totEgrUsd = totalUsd(egresos);
    const totIngUsd = totalUsd(ingresos);
    autoTable(doc, {
      body: [
        ["EGRESOS U$D", formatMilesSmart(totEgrUsd)],
        ["INGRESOS U$D", formatMilesSmart(totIngUsd)],
        ["DIFERENCIA U$D", formatMilesSmart(totEgrUsd - totIngUsd)],
      ],
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 10, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 180, right: 14 },
    });

    pdfFooter(doc);
    abrirPdf(doc);
  });

  // 1. Pase de Cajas
  const handlePaseCajas = () => runReport("pase", async () => {
    const response = await getReportePaseCajas(f.pase[0], f.pase[1]);
    const data = (response.data || []) as ReportePaseCaja[];
    if (!data.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const doc = new jsPDF();
    let y = pdfHeader(doc, "Pase de Cajas", f.pase[0], f.pase[1]);

    data.forEach((caja) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(caja.CajaDescripcion, 14, y);
      doc.setFont("helvetica", "normal");

      if (caja.pases.length > 0) {
        autoTable(doc, {
          head: [["Tipo", "Concepto", "Fecha", "Usuario", "Monto Gs."]],
          body: caja.pases.map((p) => [
            p.Tipo,
            p.GrupoDescripcion,
            new Date(p.Fecha).toLocaleDateString("es-PY"),
            p.UsuarioNombre || p.UsuarioId || "",
            formatMiles(Number(p.Monto)),
          ]),
          startY: y + 3,
          theme: "striped",
          headStyles: { fillColor: PDF_COLORS.primary },
          styles: { fontSize: 9 },
          columnStyles: { 4: { halign: "right" } },
          margin: { left: 14, right: 14 },
          didParseCell: (d) => {
            if (d.section === "body" && d.column.index === 0) {
              d.cell.styles.textColor =
                d.cell.raw === "INGRESO" ? PDF_COLORS.ingreso : PDF_COLORS.egreso;
              d.cell.styles.fontStyle = "bold";
            }
          },
        });
        y = getLastY(doc) + 10;
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...PDF_COLORS.textMuted);
        doc.text("Sin pases en el período", 14, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...PDF_COLORS.textDark);
        y += 14;
      }
    });

    // Cuadro de control: los pases deben quedar balanceados (diferencia 0)
    if (y > 240) { doc.addPage(); y = 20; }
    const diferencia = Number(response.diferencia) || 0;
    autoTable(doc, {
      body: [
        ["EGRESOS", formatMiles(Number(response.totalEgresos))],
        ["INGRESOS", formatMiles(Number(response.totalIngresos))],
        ["DIFERENCIA", formatMiles(diferencia)],
      ],
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 10, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 110, right: 14 },
      didParseCell: (d) => {
        if (d.row.index === 2) {
          d.cell.styles.textColor =
            diferencia === 0 ? PDF_COLORS.ingreso : PDF_COLORS.egreso;
        }
      },
    });

    pdfFooter(doc);
    abrirPdf(doc);
  });

  // 2. Movimientos de Cajas
  const handleMovimientos = () => runReport("mov", async () => {
    const response = await getReporteMovimientosCajas(f.mov[0], f.mov[1]);
    const movimientos = (response.data || []) as RegistroCaja[];
    if (!movimientos.length) { setError("No hay datos para el periodo seleccionado"); return; }

    // Agrupar por caja
    const porCaja: Record<number, { desc: string; ing: RegistroCaja[]; egr: RegistroCaja[]; tIng: number; tEgr: number }> = {};
    movimientos.forEach((m) => {
      if (!porCaja[m.CajaId]) porCaja[m.CajaId] = { desc: m.CajaDescripcion || `Caja ${m.CajaId}`, ing: [], egr: [], tIng: 0, tEgr: 0 };
      const monto = Number(m.RegistroDiarioCajaMonto) || 0;
      if (m.TipoGastoId === 2) { porCaja[m.CajaId].ing.push(m); porCaja[m.CajaId].tIng += monto; }
      else { porCaja[m.CajaId].egr.push(m); porCaja[m.CajaId].tEgr += monto; }
    });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte de Movimientos de Cajas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fmt(f.mov[0])} al ${fmt(f.mov[1])}`, 14, 25);
    let y = 32;

    Object.values(porCaja).forEach((caja) => {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(caja.desc, 14, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      const allRows = [...caja.ing.map((r) => [r.RegistroDiarioCajaId, new Date(r.RegistroDiarioCajaFecha).toLocaleDateString("es-PY"), "Ingreso", r.TipoGastoGrupoDescripcion || "", r.RegistroDiarioCajaDetalle || "", formatMiles(Number(r.RegistroDiarioCajaMonto))]),
        ...caja.egr.map((r) => [r.RegistroDiarioCajaId, new Date(r.RegistroDiarioCajaFecha).toLocaleDateString("es-PY"), "Egreso", r.TipoGastoGrupoDescripcion || "", r.RegistroDiarioCajaDetalle || "", formatMiles(Number(r.RegistroDiarioCajaMonto))])];
      if (allRows.length) {
        autoTable(doc, {
          head: [["ID", "Fecha", "Tipo", "Grupo", "Detalle", "Monto"]],
          body: allRows, startY: y, theme: "striped", styles: { fontSize: 7 }, margin: { left: 14, right: 14 },
        });
        y = getLastY(doc) + 4;
      }
      doc.setFontSize(9);
      doc.text(`Ingresos: Gs. ${formatMiles(caja.tIng)} | Egresos: Gs. ${formatMiles(caja.tEgr)} | Saldo: Gs. ${formatMiles(caja.tIng - caja.tEgr)}`, 14, y);
      y += 10;
    });

    window.open(doc.output("bloburl") as unknown as string, "_blank");
  });

  // 3. Cierre Diario de Caja
  const handleCierreDiario = () => runReport("cierre", async () => {
    const response = await getReporteCierreDiario(f.cierre[0], f.cierre[1]);
    const data = response.data || [];
    if (!data.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Cierre Diario de Caja", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fmt(f.cierre[0])} al ${fmt(f.cierre[1])}`, 14, 25);

    const rows = data.map((r: { CajaDescripcion: string; TotalIngresos: number; TotalEgresos: number; Saldo: number; CantMovimientos: number }) => [
      (r.CajaDescripcion || "").trim(),
      formatMiles(Number(r.TotalIngresos)),
      formatMiles(Number(r.TotalEgresos)),
      formatMiles(Number(r.Saldo)),
      r.CantMovimientos,
    ]);

    const totIng = data.reduce((s: number, r: { TotalIngresos: number }) => s + Number(r.TotalIngresos), 0);
    const totEgr = data.reduce((s: number, r: { TotalEgresos: number }) => s + Number(r.TotalEgresos), 0);
    rows.push(["TOTAL", formatMiles(totIng), formatMiles(totEgr), formatMiles(totIng - totEgr), ""]);

    autoTable(doc, {
      head: [["Caja", "Ingresos", "Egresos", "Saldo", "Mov."]],
      body: rows,
      startY: 32,
      theme: "striped",
      headStyles: { fillColor: [13, 148, 136] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    window.open(doc.output("bloburl") as unknown as string, "_blank");
  });

  // 4. Historial de Divisas
  const handleDivisas = () => runReport("divisas", async () => {
    const response = await getReporteDivisas(f.divisas[0], f.divisas[1]);
    const resumen = response.resumen || [];
    const data = response.data || [];
    if (!data.length) { setError("No hay movimientos de divisas para el periodo seleccionado"); return; }

    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.text("Historial de Cambio de Divisas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fmt(f.divisas[0])} al ${fmt(f.divisas[1])}`, 14, 25);

    // Resumen
    if (resumen.length) {
      doc.setFontSize(12);
      doc.text("Resumen por Divisa", 14, 34);
      autoTable(doc, {
        head: [["Divisa", "Compras (Cant.)", "Compras (Gs.)", "Ventas (Cant.)", "Ventas (Gs.)", "Operaciones"]],
        body: resumen.map((r: { DivisaNombre: string; CantCompra: number; MontoCompra: number; CantVenta: number; MontoVenta: number; CantOperaciones: number }) => [
          (r.DivisaNombre || "").trim(), formatMilesSmart(Number(r.CantCompra)), formatMilesSmart(Number(r.MontoCompra)),
          formatMilesSmart(Number(r.CantVenta)), formatMilesSmart(Number(r.MontoVenta)), r.CantOperaciones,
        ]),
        startY: 38, theme: "striped", headStyles: { fillColor: [13, 148, 136] }, styles: { fontSize: 9 },
      });
    }

    // Detalle
    const detY = resumen.length ? getLastY(doc) + 10 : 34;
    doc.setFontSize(12);
    doc.text("Detalle de Operaciones", 14, detY);
    autoTable(doc, {
      head: [["ID", "Fecha", "Divisa", "Tipo", "Cambio", "Cantidad", "Monto Gs.", "Usuario", "Caja"]],
      body: data.map((r: { DivisaMovimientoId: number; DivisaMovimientoFecha: string; DivisaNombre: string; DivisaMovimientoTipo: string; DivisaMovimientoCambio: number; DivisaMovimientoCantidad: number; DivisaMovimientoMonto: number; UsuarioNombre: string; CajaDescripcion: string }) => [
        r.DivisaMovimientoId, new Date(r.DivisaMovimientoFecha).toLocaleDateString("es-PY"),
        (r.DivisaNombre || "").trim(), r.DivisaMovimientoTipo === "C" ? "Compra" : "Venta",
        formatMilesSmart(Number(r.DivisaMovimientoCambio)), formatMilesSmart(Number(r.DivisaMovimientoCantidad)),
        formatMilesSmart(Number(r.DivisaMovimientoMonto)), (r.UsuarioNombre || "").trim(), (r.CajaDescripcion || "").trim(),
      ]),
      startY: detY + 4, theme: "striped", styles: { fontSize: 8 },
    });

    window.open(doc.output("bloburl") as unknown as string, "_blank");
  });

  // ── Render ──

  return (
    <div className="w-full">
      <PageHeader title="Reportes" icon={BarChart3} subtitle="Genera reportes en PDF" />

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 0. Ingresos/Egresos Resumen */}
        <ReportCard
          title="Ingresos/Egresos Resumen"
          description="Totales por concepto, agrupados en ingresos y egresos"
          icon={<BarChart3 className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.resumen[0]} fechaFin={f.resumen[1]}
            onChangeFechaInicio={(v) => updateF("resumen", 0, v)} onChangeFechaFin={(v) => updateF("resumen", 1, v)} />
          <Button onClick={handleIngresosEgresos} disabled={loading === "resumen"} className="w-full">
            {loading === "resumen" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 0b. Registro Diario */}
        <ReportCard
          title="Registro Diario"
          description="Apertura/cierre por caja con todos los movimientos y control de sobrante/faltante"
          icon={<FileText className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.registro[0]} fechaFin={f.registro[1]}
            onChangeFechaInicio={(v) => updateF("registro", 0, v)} onChangeFechaFin={(v) => updateF("registro", 1, v)} />
          <Button onClick={handleRegistroDiario} disabled={loading === "registro"} className="w-full">
            {loading === "registro" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 0c. Western Ingresos/Egresos */}
        <ReportCard
          title="Western (Ingresos/Egresos)"
          description="Pagos y envíos Western en guaraníes, con totales y diferencia"
          icon={<ArrowLeftRight className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.westerngs[0]} fechaFin={f.westerngs[1]}
            onChangeFechaInicio={(v) => updateF("westerngs", 0, v)} onChangeFechaFin={(v) => updateF("westerngs", 1, v)} />
          <Button onClick={handleWesternGs} disabled={loading === "westerngs"} className="w-full">
            {loading === "westerngs" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 0d. Western USD */}
        <ReportCard
          title="Western USD"
          description="Pagos y envíos Western en dólares con cotización"
          icon={<ArrowLeftRight className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.westernusd[0]} fechaFin={f.westernusd[1]}
            onChangeFechaInicio={(v) => updateF("westernusd", 0, v)} onChangeFechaFin={(v) => updateF("westernusd", 1, v)} />
          <Button onClick={handleWesternUsd} disabled={loading === "westernusd"} className="w-full">
            {loading === "westernusd" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 1. Cierre Diario */}
        <ReportCard
          title="Cierre Diario de Caja"
          description="Resumen de ingresos, egresos y saldo por caja"
          icon={<Wallet className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.cierre[0]} fechaFin={f.cierre[1]}
            onChangeFechaInicio={(v) => updateF("cierre", 0, v)} onChangeFechaFin={(v) => updateF("cierre", 1, v)} />
          <Button onClick={handleCierreDiario} disabled={loading === "cierre"} className="w-full">
            {loading === "cierre" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 2. Historial de Divisas */}
        <ReportCard
          title="Historial de Divisas"
          description="Compras, ventas, tipos de cambio y resumen por moneda"
          icon={<ArrowLeftRight className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.divisas[0]} fechaFin={f.divisas[1]}
            onChangeFechaInicio={(v) => updateF("divisas", 0, v)} onChangeFechaFin={(v) => updateF("divisas", 1, v)} />
          <Button onClick={handleDivisas} disabled={loading === "divisas"} className="w-full">
            {loading === "divisas" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 6. Pase de Cajas */}
        <ReportCard
          title="Pase de Cajas"
          description="Pases entre cajas, con control de egresos/ingresos y diferencia"
          icon={<FileText className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.pase[0]} fechaFin={f.pase[1]}
            onChangeFechaInicio={(v) => updateF("pase", 0, v)} onChangeFechaFin={(v) => updateF("pase", 1, v)} />
          <Button onClick={handlePaseCajas} disabled={loading === "pase"} className="w-full">
            {loading === "pase" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>

        {/* 7. Movimientos de Cajas */}
        <ReportCard
          title="Movimientos de Cajas"
          description="Todos los movimientos de cajas internas (CajaTipoId=1)"
          icon={<FileText className="size-5 text-primary" />}
        >
          <DateRange fechaInicio={f.mov[0]} fechaFin={f.mov[1]}
            onChangeFechaInicio={(v) => updateF("mov", 0, v)} onChangeFechaFin={(v) => updateF("mov", 1, v)} />
          <Button onClick={handleMovimientos} disabled={loading === "mov"} className="w-full">
            {loading === "mov" ? "Generando..." : "Generar PDF"}
          </Button>
        </ReportCard>
      </div>
    </div>
  );
};

export default ReportesPage;
