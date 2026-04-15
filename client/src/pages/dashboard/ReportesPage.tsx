import { BarChart3, FileText, Wallet, ArrowLeftRight, AlertTriangle } from "lucide-react";
import React, { useState } from "react";
import { usePermiso } from "../../hooks/usePermiso";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMiles } from "../../utils/utils";
import {
  getReportePaseCajas,
  getReporteMovimientosCajas,
  getReporteCierreDiario,
  getReporteDivisas,
} from "../../services/registros.service";
import PageHeader from "../../components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  CajaDescripcion: string;
  TipoGastoDescripcion: string;
  TipoGastoGrupoDescripcion: string;
}

interface ReporteCaja {
  CajaId: number;
  CajaDescripcion: string;
  ingresos: RegistroCaja[];
  egresos: RegistroCaja[];
  totalIngresos: number;
  totalEgresos: number;
  saldo: number;
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
        <Input type="date" value={fechaInicio} onChange={(e) => onChangeFechaInicio(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
        <Input type="date" value={fechaFin} onChange={(e) => onChangeFechaFin(e.target.value)} />
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

  // 1. Pase de Cajas
  const handlePaseCajas = () => runReport("pase", async () => {
    const response = await getReportePaseCajas(f.pase[0], f.pase[1]);
    const data = (response.data || []) as ReporteCaja[];
    if (!data.length) { setError("No hay datos para el periodo seleccionado"); return; }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte de Pase de Cajas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fmt(f.pase[0])} al ${fmt(f.pase[1])}`, 14, 25);
    let y = 32;

    data.forEach((caja, i) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${caja.CajaDescripcion}`, 14, y);
      doc.setFont("helvetica", "normal");
      y += 6;

      // Ingresos
      if (caja.ingresos.length > 0) {
        autoTable(doc, {
          head: [["ID", "Fecha", "Usuario", "Detalle", "Monto"]],
          body: caja.ingresos.map((r) => [
            r.RegistroDiarioCajaId, new Date(r.RegistroDiarioCajaFecha).toLocaleDateString("es-PY"),
            r.UsuarioId || "", r.RegistroDiarioCajaDetalle || "", formatMiles(r.RegistroDiarioCajaMonto),
          ]),
          startY: y, theme: "striped", headStyles: { fillColor: [16, 185, 129] },
          styles: { fontSize: 8 }, margin: { left: 14, right: 14 },
        });
        y = getLastY(doc) + 4;
      }
      doc.setFontSize(9);
      doc.text(`Ingresos: Gs. ${formatMiles(caja.totalIngresos)}`, 14, y);
      y += 4;

      // Egresos
      if (caja.egresos.length > 0) {
        autoTable(doc, {
          head: [["ID", "Fecha", "Usuario", "Detalle", "Monto"]],
          body: caja.egresos.map((r) => [
            r.RegistroDiarioCajaId, new Date(r.RegistroDiarioCajaFecha).toLocaleDateString("es-PY"),
            r.UsuarioId || "", r.RegistroDiarioCajaDetalle || "", formatMiles(r.RegistroDiarioCajaMonto),
          ]),
          startY: y, theme: "striped", headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 8 }, margin: { left: 14, right: 14 },
        });
        y = getLastY(doc) + 4;
      }
      doc.setFontSize(9);
      doc.text(`Egresos: Gs. ${formatMiles(caja.totalEgresos)}`, 14, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Saldo: Gs. ${formatMiles(caja.saldo)}`, 14, y);
      doc.setFont("helvetica", "normal");
      y += 10;
      if (i < data.length - 1) { doc.line(14, y - 4, 196, y - 4); }
    });

    window.open(doc.output("bloburl") as unknown as string, "_blank");
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
      headStyles: { fillColor: [79, 70, 229] },
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
          (r.DivisaNombre || "").trim(), formatMiles(Number(r.CantCompra)), formatMiles(Number(r.MontoCompra)),
          formatMiles(Number(r.CantVenta)), formatMiles(Number(r.MontoVenta)), r.CantOperaciones,
        ]),
        startY: 38, theme: "striped", headStyles: { fillColor: [79, 70, 229] }, styles: { fontSize: 9 },
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
        formatMiles(Number(r.DivisaMovimientoCambio)), formatMiles(Number(r.DivisaMovimientoCantidad)),
        formatMiles(Number(r.DivisaMovimientoMonto)), (r.UsuarioNombre || "").trim(), (r.CajaDescripcion || "").trim(),
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
          description="Detalle de ingresos y egresos por caja"
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
