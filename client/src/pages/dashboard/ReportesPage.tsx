import { BarChart3, FileText, Wallet, ArrowLeftRight, AlertTriangle, HandCoins } from "lucide-react";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";
import { getTiposGastoGrupo, type TipoGastoGrupo } from "../../services/tipogastogrupo.service";
import { getCajas } from "../../services/cajas.service";
import { getColegios } from "../../services/colegio.service";
import { getTransportes } from "../../services/transporte.service";
import { SinDatosError } from "../../utils/pdfReport";
import { generarIngresosEgresosResumen } from "../../reports/ingresosEgresosResumen";
import { generarRegistroDiario, generarIngresoEgresoPorCaja } from "../../reports/registroDiario";
import { generarWesternGs, generarWesternUsd } from "../../reports/western";
import { generarAnticipos } from "../../reports/anticipos";
import { generarPaseCajas } from "../../reports/paseCajas";
import { generarMovimientosCajas } from "../../reports/movimientosCajas";
import { generarCierreDiario } from "../../reports/cierreDiario";
import { generarDivisas } from "../../reports/divisas";
import { generarCobranzaColegios } from "../../reports/cobranzaColegios";
import { generarJSI } from "../../reports/jsi";
import { generarElComercio } from "../../reports/elComercio";
import { generarEmpresaTransporte } from "../../reports/empresaTransporte";
import PageHeader from "../../components/common/PageHeader";
import { Button } from "@/components/ui/button";
import CampoFecha from "@/components/common/CampoFecha";

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
        <div className="p-2 rounded-lg bg-primary-50 shrink-0">{icon}</div>
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

const inputClassName =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors";

function DateRange({ fechaInicio, fechaFin, onChangeFechaInicio, onChangeFechaFin }: DateRangeProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
        <CampoFecha
          type="date"
          value={fechaInicio}
          onChange={(e) => onChangeFechaInicio(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
        <CampoFecha
          type="date"
          value={fechaFin}
          onChange={(e) => onChangeFechaFin(e.target.value)}
          className={inputClassName}
        />
      </div>
    </div>
  );
}

// ── Pagina principal ──

const ReportesPage: React.FC = () => {
  const puedeLeer = usePermiso("REPORTES", "leer");
  const [loading, setLoading] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  // Rango de fechas por reporte: [desde, hasta]
  const [f, setF] = useState({
    resumen: [today, today],
    registro: [today, today],
    porcaja: [today, today],
    colegios: [today, today],
    jsi: [today, today],
    comercio: [today, today],
    transporte: [today, today],
    westerngs: [today, today],
    westernusd: [today, today],
    anticipos: [today, today],
    cierre: [today, today],
    divisas: [today, today],
    pase: [today, today],
    mov: [today, today],
  });

  // Grupos de gasto para el selector del reporte de Anticipos
  const [grupos, setGrupos] = useState<string[]>([]);
  const [grupoAnticipo, setGrupoAnticipo] = useState("");

  // Cajas tipo 1 para el selector de Ingreso/Egreso por Caja
  const [cajas, setCajas] = useState<{ id: number; desc: string }[]>([]);
  const [cajaReporte, setCajaReporte] = useState("");

  // Colegios para el selector de Cobranza Colegios
  const [colegios, setColegios] = useState<{ id: number; desc: string }[]>([]);
  const [colegioReporte, setColegioReporte] = useState("");

  // Empresas de transporte para el selector de Empresa de Transporte
  const [transportes, setTransportes] = useState<{ id: number; desc: string }[]>([]);
  const [transporteReporte, setTransporteReporte] = useState("");

  useEffect(() => {
    getTiposGastoGrupo()
      .then((data: TipoGastoGrupo[]) => {
        const descripciones = Array.from(
          new Set(
            (data || []).map((g) => (g.TipoGastoGrupoDescripcion || "").trim()).filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, "es"));
        setGrupos(descripciones);
      })
      .catch((err) => console.error("Error al cargar grupos de gasto:", err));

    getCajas(1, 1000, undefined, undefined, 1)
      .then((data: { data: { CajaId: number; CajaDescripcion: string }[] }) => {
        setCajas(
          (data.data || []).map((c) => ({
            id: c.CajaId,
            desc: (c.CajaDescripcion || `Caja ${c.CajaId}`).trim(),
          }))
        );
      })
      .catch((err) => console.error("Error al cargar cajas:", err));

    getColegios(1, 1000, "ColegioNombre", "asc")
      .then((data: { data: { ColegioId: number; ColegioNombre: string }[] }) => {
        setColegios(
          (data.data || []).map((c) => ({
            id: c.ColegioId,
            desc: (c.ColegioNombre || `Colegio ${c.ColegioId}`).trim(),
          }))
        );
      })
      .catch((err) => console.error("Error al cargar colegios:", err));

    getTransportes(1, 1000, "TransporteNombre", "asc")
      .then((data: { data: { TransporteId: number; TransporteNombre: string }[] }) => {
        setTransportes(
          (data.data || []).map((t) => ({
            id: t.TransporteId,
            desc: (t.TransporteNombre || `Transporte ${t.TransporteId}`).trim(),
          }))
        );
      })
      .catch((err) => console.error("Error al cargar transportes:", err));
  }, []);

  const updateF = (key: keyof typeof f, idx: 0 | 1, val: string) => {
    setF((prev) => {
      const arr = [...prev[key]];
      arr[idx] = val;
      return { ...prev, [key]: arr };
    });
  };

  const runReport = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Error al generar el reporte";
      const sinDatos = err instanceof SinDatosError;
      if (!sinDatos) console.error(err);
      Swal.fire({
        icon: sinDatos ? "info" : "error",
        title: sinDatos ? "Sin datos" : "Error",
        text: msg,
        confirmButtonColor: "#0d9488",
      });
    } finally {
      setLoading(null);
    }
  };

  if (!puedeLeer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="size-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver los reportes</p>
      </div>
    );
  }

  // ── Definición de reportes: la tarjeta, sus filtros y su generador ──

  interface ReporteDef {
    key: keyof typeof f;
    title: string;
    description: string;
    icon: React.ReactNode;
    run: (desde: string, hasta: string) => Promise<void>;
    disabled?: boolean;
    extra?: React.ReactNode;
  }

  const reportes: ReporteDef[] = [
    {
      key: "resumen",
      title: "Ingresos/Egresos Resumen",
      description: "Totales por concepto, agrupados en ingresos y egresos",
      icon: <BarChart3 className="size-5 text-primary" />,
      run: generarIngresosEgresosResumen,
    },
    {
      key: "registro",
      title: "Registro Diario",
      description: "Apertura/cierre por caja con todos los movimientos y control de sobrante/faltante",
      icon: <FileText className="size-5 text-primary" />,
      run: generarRegistroDiario,
    },
    {
      key: "porcaja",
      title: "Ingreso/Egreso por Caja",
      description: "Movimientos de una caja con control de sobrante/faltante",
      icon: <Wallet className="size-5 text-primary" />,
      run: (desde, hasta) => generarIngresoEgresoPorCaja(desde, hasta, cajaReporte),
      disabled: !cajaReporte,
      extra: (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Caja</label>
          <select
            value={cajaReporte}
            onChange={(e) => setCajaReporte(e.target.value)}
            className={inputClassName}
          >
            <option value="">Seleccioná una caja...</option>
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>{c.desc}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "colegios",
      title: "Cobranza Colegios",
      description: "Cobranzas por curso y alumno: cuotas, multas, exámenes y descuentos",
      icon: <FileText className="size-5 text-primary" />,
      run: (desde, hasta) =>
        generarCobranzaColegios(
          desde,
          hasta,
          colegioReporte,
          colegios.find((c) => String(c.id) === colegioReporte)?.desc || ""
        ),
      disabled: !colegioReporte,
      extra: (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Colegio</label>
          <select
            value={colegioReporte}
            onChange={(e) => setColegioReporte(e.target.value)}
            className={inputClassName}
          >
            <option value="">Seleccioná un colegio...</option>
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>{c.desc}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "jsi",
      title: "J.S.I.",
      description: "Rendición de cobros a la Junta de Saneamiento de Itauguá",
      icon: <FileText className="size-5 text-primary" />,
      run: generarJSI,
    },
    {
      key: "comercio",
      title: "El Comercio",
      description: "Resumen de operaciones de la financiera (grupos WEPA / WEPA USD)",
      icon: <BarChart3 className="size-5 text-primary" />,
      run: generarElComercio,
    },
    {
      key: "transporte",
      title: "Empresa de Transporte",
      description: "Ventas de pasajes con liquidación y comisión de la empresa",
      icon: <FileText className="size-5 text-primary" />,
      run: (desde, hasta) =>
        generarEmpresaTransporte(
          desde,
          hasta,
          transporteReporte,
          transportes.find((t) => String(t.id) === transporteReporte)?.desc || ""
        ),
      disabled: !transporteReporte,
      extra: (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Transporte</label>
          <select
            value={transporteReporte}
            onChange={(e) => setTransporteReporte(e.target.value)}
            className={inputClassName}
          >
            <option value="">Seleccioná una empresa...</option>
            {transportes.map((t) => (
              <option key={t.id} value={t.id}>{t.desc}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "westerngs",
      title: "Western (Ingresos/Egresos)",
      description: "Pagos y envíos Western en guaraníes, con totales y diferencia",
      icon: <ArrowLeftRight className="size-5 text-primary" />,
      run: generarWesternGs,
    },
    {
      key: "westernusd",
      title: "Western USD",
      description: "Pagos y envíos Western en dólares con cotización",
      icon: <ArrowLeftRight className="size-5 text-primary" />,
      run: generarWesternUsd,
    },
    {
      key: "anticipos",
      title: "Anticipos",
      description: "Movimientos de un grupo de gasto: egresos, ingresos y equivalente USD",
      icon: <HandCoins className="size-5 text-primary" />,
      run: (desde, hasta) => generarAnticipos(desde, hasta, grupoAnticipo),
      disabled: !grupoAnticipo,
      extra: (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Grupo</label>
          <select
            value={grupoAnticipo}
            onChange={(e) => setGrupoAnticipo(e.target.value)}
            className={inputClassName}
          >
            <option value="">Seleccioná un grupo...</option>
            {grupos.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "cierre",
      title: "Cierre Diario de Caja",
      description: "Resumen de ingresos, egresos y saldo por caja",
      icon: <Wallet className="size-5 text-primary" />,
      run: generarCierreDiario,
    },
    {
      key: "divisas",
      title: "Historial de Divisas",
      description: "Compras, ventas, tipos de cambio y resumen por moneda",
      icon: <ArrowLeftRight className="size-5 text-primary" />,
      run: generarDivisas,
    },
    {
      key: "pase",
      title: "Pase de Cajas",
      description: "Pases entre cajas, con control de egresos/ingresos y diferencia",
      icon: <FileText className="size-5 text-primary" />,
      run: generarPaseCajas,
    },
    {
      key: "mov",
      title: "Movimientos de Cajas",
      description: "Todos los movimientos de cajas internas (CajaTipoId=1)",
      icon: <FileText className="size-5 text-primary" />,
      run: generarMovimientosCajas,
    },
  ];

  return (
    <div className="w-full">
      <PageHeader title="Reportes" icon={BarChart3} subtitle="Genera reportes en PDF" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reportes.map((rep) => (
          <ReportCard key={rep.key} title={rep.title} description={rep.description} icon={rep.icon}>
            {rep.extra}
            <DateRange
              fechaInicio={f[rep.key][0]}
              fechaFin={f[rep.key][1]}
              onChangeFechaInicio={(v) => updateF(rep.key, 0, v)}
              onChangeFechaFin={(v) => updateF(rep.key, 1, v)}
            />
            <Button
              onClick={() => runReport(rep.key, () => rep.run(f[rep.key][0], f[rep.key][1]))}
              disabled={loading === rep.key || rep.disabled}
              className="w-full"
            >
              {loading === rep.key ? "Generando..." : "Generar PDF"}
            </Button>
          </ReportCard>
        ))}
      </div>
    </div>
  );
};

export default ReportesPage;
