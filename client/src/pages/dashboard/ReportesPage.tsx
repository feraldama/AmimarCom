import {
  BarChart3,
  FileText,
  Wallet,
  ArrowLeftRight,
  AlertTriangle,
  HandCoins,
  School,
  Bus,
  Search,
  History,
  FileDown,
  type LucideIcon,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";
import { useAuth } from "../../contexts/useAuth";
import { getTiposGastoGrupo, type TipoGastoGrupo } from "../../services/tipogastogrupo.service";
import { getCajas } from "../../services/cajas.service";
import { getMiCaja } from "../../services/registros.service";
import { getColegios } from "../../services/colegio.service";
import { getTransportes } from "../../services/transporte.service";
import { SinDatosError } from "../../utils/pdfReport";
import { fechaHoyLocal } from "../../utils/utils";
import { generarIngresosEgresosResumen } from "../../reports/ingresosEgresosResumen";
import { generarRegistroDiario, generarIngresoEgresoPorCaja } from "../../reports/registroDiario";
import { generarWesternGs, generarWesternUsd } from "../../reports/western";
import { generarAnticipos } from "../../reports/anticipos";
import { generarPaseCajas } from "../../reports/paseCajas";
import { generarMovimientosCajas } from "../../reports/movimientosCajas";
import { generarCierreDiario } from "../../reports/cierreDiario";
import { generarDivisas } from "../../reports/divisas";
import { generarCobranzaColegios } from "../../reports/cobranzaColegios";
import {
  generarEstadoResultadosColegios,
  generarEstadoResultadosColegiosMensual,
} from "../../reports/estadoResultadosColegios";
import { generarJSI } from "../../reports/jsi";
import { generarElComercio } from "../../reports/elComercio";
import { generarEmpresaTransporte } from "../../reports/empresaTransporte";
import PageHeader from "../../components/common/PageHeader";
import { Button } from "@/components/ui/button";
import CampoFecha from "@/components/common/CampoFecha";
import type { CajaFiltro } from "../../reports/types";

// ── Grupos de la lista de reportes (en este orden) ──

const GRUPOS = ["Caja", "Colegios", "Cambios y remesas", "Convenios"] as const;

type Grupo = (typeof GRUPOS)[number];

// ── Atajos de período ──

const isoLocal = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** "2026-09-01" → "01/09/2026" */
const fechaCorta = (iso: string): string => iso.split("-").reverse().join("/");

function atajosPeriodo(): { label: string; rango: [string, string] }[] {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  // Semana de lunes a hoy
  const lunes = new Date(y, m, hoy.getDate() - ((hoy.getDay() + 6) % 7));
  return [
    { label: "Hoy", rango: [isoLocal(hoy), isoLocal(hoy)] },
    { label: "Esta semana", rango: [isoLocal(lunes), isoLocal(hoy)] },
    { label: "Este mes", rango: [isoLocal(new Date(y, m, 1)), isoLocal(new Date(y, m + 1, 0))] },
    { label: "Mes anterior", rango: [isoLocal(new Date(y, m - 1, 1)), isoLocal(new Date(y, m, 0))] },
    { label: "Este año", rango: [isoLocal(new Date(y, 0, 1)), isoLocal(hoy)] },
  ];
}

// ── Generados recientemente (solo en este navegador) ──

interface Reciente {
  key: string;
  desde: string;
  hasta: string;
}

const RECIENTES_KEY = "reportes.recientes";
const MAX_RECIENTES = 5;

function leerRecientes(): Reciente[] {
  try {
    const data = JSON.parse(localStorage.getItem(RECIENTES_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function guardarRecientes(lista: Reciente[]) {
  try {
    localStorage.setItem(RECIENTES_KEY, JSON.stringify(lista));
  } catch {
    // sin almacenamiento disponible: los recientes no se recuerdan
  }
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
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 mb-3">
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
      <div className="flex flex-wrap gap-2">
        {atajosPeriodo().map(({ label, rango }) => {
          const activo = fechaInicio === rango[0] && fechaFin === rango[1];
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                onChangeFechaInicio(rango[0]);
                onChangeFechaFin(rango[1]);
              }}
              className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                activo
                  ? "border-primary bg-primary-50 text-primary-700"
                  : "border-border bg-white text-secondary-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Componente SelectorCajas ──
// Filtro de cajas común a todos los reportes: casillas de verificación,
// ninguna marcada = todas las cajas (sin filtro).

interface SelectorCajasProps {
  cajas: { id: number; desc: string }[];
  seleccion: string[];
  onToggle: (id: string) => void;
  /** Selección fija (usuario limitado a su caja): casillas no editables. */
  bloqueado?: boolean;
}

function SelectorCajas({ cajas, seleccion, onToggle, bloqueado }: SelectorCajasProps) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {bloqueado ? "Caja" : "Cajas (todas si no marcás ninguna)"}
      </label>
      <div className="max-h-32 overflow-y-auto rounded-lg border border-input bg-background px-3 py-2 space-y-1">
        {cajas.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
          >
            <input
              type="checkbox"
              checked={seleccion.includes(String(c.id))}
              onChange={() => onToggle(String(c.id))}
              disabled={bloqueado}
              className="accent-primary"
            />
            {c.desc}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Permisos ──
// REPORTES (leer) habilita todos los reportes con todas las cajas. Sin él, el
// permiso específico de cada reporte lo habilita limitado a la caja del
// usuario, salvo que además tenga REPORTESTODASCAJAS (leer), que quita ese
// límite (el backend aplica la misma regla en cada endpoint).

const PERMISO_REPORTE = {
  resumen: "REPORTEINGRESOSEGRESOS",
  registro: "REPORTEREGISTRODIARIO",
  porcaja: "REPORTEPORCAJA",
  colegios: "REPORTECOLEGIOS",
  resultados: "REPORTEESTADORESULTADOS",
  jsi: "REPORTEJSI",
  comercio: "REPORTEELCOMERCIO",
  transporte: "REPORTETRANSPORTE",
  westerngs: "REPORTEWESTERN",
  westernusd: "REPORTEWESTERNUSD",
  anticipos: "REPORTEANTICIPOS",
  cierre: "REPORTECIERREDIARIO",
  divisas: "REPORTEDIVISAS",
  pase: "REPORTEPASECAJAS",
  mov: "REPORTEMOVIMIENTOSCAJAS",
} as const;

type ReporteKey = keyof typeof PERMISO_REPORTE;

// ── Pagina principal ──

const ReportesPage: React.FC = () => {
  const { permisos } = useAuth();
  const puedeLeerTodos = usePermiso("REPORTES", "leer");
  const puedeVer = (key: ReporteKey) =>
    puedeLeerTodos || !!permisos?.[PERMISO_REPORTE[key]]?.leer;
  // REPORTESTODASCAJAS: sus reportes específicos con todas las cajas
  const todasLasCajas = usePermiso("REPORTESTODASCAJAS", "leer");
  const soloSuCaja = !puedeLeerTodos && !todasLasCajas;
  const puedeLeer = (Object.keys(PERMISO_REPORTE) as ReporteKey[]).some(puedeVer);
  const [loading, setLoading] = useState<string | null>(null);
  const today = fechaHoyLocal();

  // Rango de fechas por reporte: [desde, hasta]
  const [f, setF] = useState({
    resumen: [today, today],
    registro: [today, today],
    porcaja: [today, today],
    colegios: [today, today],
    resultados: [today, today],
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
  // Estado de resultados: "" = todos los colegios
  const [colegioResultados, setColegioResultados] = useState("");
  const [resultadosPorMes, setResultadosPorMes] = useState(false);

  // Empresas de transporte para el selector de Empresa de Transporte
  const [transportes, setTransportes] = useState<{ id: number; desc: string }[]>([]);
  const [transporteReporte, setTransporteReporte] = useState("");

  // Filtro de cajas por reporte (clave = key del reporte). Lista vacía o
  // ausente = todas las cajas. Compartido por todas las tarjetas.
  const [cajasSel, setCajasSel] = useState<Record<string, string[]>>({});

  const toggleCajaSel = (key: string, id: string) => {
    setCajasSel((prev) => {
      const actual = prev[key] || [];
      return {
        ...prev,
        [key]: actual.includes(id)
          ? actual.filter((c) => c !== id)
          : [...actual, id],
      };
    });
  };

  // Cajas seleccionadas de un reporte como CajaFiltro[] (con descripción,
  // para que el PDF pueda listar por qué cajas se filtró)
  // (limitado a su caja: siempre la única caja cargada)
  const seleccionDe = (key: string): string[] =>
    soloSuCaja ? cajas.map((c) => String(c.id)) : cajasSel[key] || [];

  const cajasFiltroDe = (key: string): CajaFiltro[] =>
    seleccionDe(key)
      .map((id) => cajas.find((c) => String(c.id) === id))
      .filter((c): c is { id: number; desc: string } => c !== undefined)
      .map((c) => ({ id: c.id, desc: c.desc }));

  // Tipo de movimiento del reporte de Movimientos de Cajas
  // ("" ambos, "1" egresos, "2" ingresos)
  const [movTipo, setMovTipo] = useState("");

  // Reporte abierto en el panel de detalle (null = el primero visible)
  const [seleccionado, setSeleccionado] = useState<ReporteKey | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [recientes, setRecientes] = useState<Reciente[]>(leerRecientes);

  const agregarReciente = (r: Reciente) => {
    setRecientes((prev) => {
      const lista = [
        r,
        ...prev.filter((p) => !(p.key === r.key && p.desde === r.desde && p.hasta === r.hasta)),
      ].slice(0, MAX_RECIENTES);
      guardarRecientes(lista);
      return lista;
    });
  };

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

    if (soloSuCaja) {
      // Única caja disponible, ya seleccionada (el backend además la fuerza)
      getMiCaja()
        .then((caja) => {
          if (!caja) return;
          const desc = (caja.CajaDescripcion || `Caja ${caja.CajaId}`).trim();
          setCajas([{ id: caja.CajaId, desc }]);
          setCajaReporte(String(caja.CajaId));
        })
        .catch((err) => console.error("Error al cargar la caja del usuario:", err));
    } else {
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
    }

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
  }, [soloSuCaja]);

  const updateF = (key: keyof typeof f, idx: 0 | 1, val: string) => {
    setF((prev) => {
      const arr = [...prev[key]];
      arr[idx] = val;
      return { ...prev, [key]: arr };
    });
  };

  const runReport = async (key: string, fn: () => Promise<void>, reciente?: Reciente) => {
    setLoading(key);
    try {
      await fn();
      if (reciente) agregarReciente(reciente);
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
    icon: LucideIcon;
    grupo: Grupo;
    run: (
      desde: string,
      hasta: string,
      cajasFiltro: CajaFiltro[]
    ) => Promise<void>;
    disabled?: boolean;
    extra?: React.ReactNode;
    /** Oculta el filtro de cajas común (para reportes con selector propio). */
    sinFiltroCajas?: boolean;
    /** Siempre todas las cajas: no aplica el límite "solo su caja". */
    todasLasCajas?: boolean;
  }

  const todosLosReportes: ReporteDef[] = [
    {
      key: "resumen",
      grupo: "Caja",
      title: "Ingresos/Egresos Resumen",
      description: "Totales por concepto, agrupados en ingresos y egresos",
      icon: BarChart3,
      run: generarIngresosEgresosResumen,
    },
    {
      key: "registro",
      grupo: "Caja",
      title: "Registro Diario",
      description: "Apertura/cierre por caja con todos los movimientos y control de sobrante/faltante",
      icon: FileText,
      run: generarRegistroDiario,
    },
    {
      key: "porcaja",
      grupo: "Caja",
      title: "Ingreso/Egreso por Caja",
      description: "Movimientos de una caja con control de sobrante/faltante",
      icon: Wallet,
      run: (desde, hasta) => generarIngresoEgresoPorCaja(desde, hasta, cajaReporte),
      disabled: !cajaReporte,
      sinFiltroCajas: true,
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
      grupo: "Colegios",
      title: "Cobranza Colegios",
      description: "Cobranzas por curso y alumno: cuotas, multas, exámenes y descuentos",
      icon: School,
      run: (desde, hasta, cajasFiltro) =>
        generarCobranzaColegios(
          desde,
          hasta,
          colegioReporte,
          colegios.find((c) => String(c.id) === colegioReporte)?.desc || "",
          cajasFiltro
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
      key: "resultados",
      grupo: "Colegios",
      title: "Estado de Resultados Colegios",
      description: "Por colegio: ingresos menos retiros y salarios de profesores",
      icon: BarChart3,
      run: (desde, hasta) =>
        (resultadosPorMes
          ? generarEstadoResultadosColegiosMensual
          : generarEstadoResultadosColegios)(desde, hasta, colegioResultados),
      sinFiltroCajas: true,
      todasLasCajas: true,
      extra: (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Colegio</label>
            <select
              value={colegioResultados}
              onChange={(e) => setColegioResultados(e.target.value)}
              className={inputClassName}
            >
              <option value="">Todos los colegios</option>
              {colegios.map((c) => (
                <option key={c.id} value={c.id}>{c.desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vista</label>
            <select
              value={resultadosPorMes ? "mes" : "periodo"}
              onChange={(e) => setResultadosPorMes(e.target.value === "mes")}
              className={inputClassName}
            >
              <option value="periodo">Total del período</option>
              <option value="mes">Mes por mes (hasta 12)</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      key: "jsi",
      grupo: "Convenios",
      title: "J.S.I.",
      description: "Rendición de cobros a la Junta de Saneamiento de Itauguá",
      icon: FileText,
      run: generarJSI,
    },
    {
      key: "comercio",
      grupo: "Convenios",
      title: "El Comercio",
      description: "Resumen de operaciones de la financiera (grupos WEPA / WEPA USD)",
      icon: BarChart3,
      run: generarElComercio,
    },
    {
      key: "transporte",
      grupo: "Convenios",
      title: "Empresa de Transporte",
      description: "Ventas de pasajes con liquidación y comisión de la empresa",
      icon: Bus,
      run: (desde, hasta, cajasFiltro) =>
        generarEmpresaTransporte(
          desde,
          hasta,
          transporteReporte,
          transportes.find((t) => String(t.id) === transporteReporte)?.desc || "",
          cajasFiltro
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
      grupo: "Cambios y remesas",
      title: "Western (Ingresos/Egresos)",
      description: "Pagos y envíos Western en guaraníes, con totales y diferencia",
      icon: ArrowLeftRight,
      run: generarWesternGs,
    },
    {
      key: "westernusd",
      grupo: "Cambios y remesas",
      title: "Western USD",
      description:
        "Pagos y envíos Western en dólares, con cotización y USD puro",
      icon: ArrowLeftRight,
      run: generarWesternUsd,
    },
    {
      key: "anticipos",
      grupo: "Caja",
      title: "Anticipos",
      description: "Movimientos de un grupo de gasto: egresos, ingresos y equivalente USD",
      icon: HandCoins,
      run: (desde, hasta, cajasFiltro) =>
        generarAnticipos(desde, hasta, grupoAnticipo, cajasFiltro),
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
      grupo: "Caja",
      title: "Cierre Diario de Caja",
      description: "Resumen de ingresos, egresos y saldo por caja",
      icon: Wallet,
      run: generarCierreDiario,
    },
    {
      key: "divisas",
      grupo: "Cambios y remesas",
      title: "Historial de Divisas",
      description: "Compras, ventas, tipos de cambio y resumen por moneda",
      icon: ArrowLeftRight,
      run: generarDivisas,
    },
    {
      key: "pase",
      grupo: "Caja",
      title: "Pase de Cajas",
      description: "Pases entre cajas, con control de egresos/ingresos y diferencia",
      icon: FileText,
      run: generarPaseCajas,
    },
    {
      key: "mov",
      grupo: "Caja",
      title: "Movimientos de Cajas",
      description:
        "Movimientos de cajas internas, con filtro por caja y tipo de movimiento",
      icon: FileText,
      run: (desde, hasta, cajasFiltro) =>
        generarMovimientosCajas(desde, hasta, cajasFiltro, movTipo),
      extra: (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Tipo de movimiento
          </label>
          <select
            value={movTipo}
            onChange={(e) => setMovTipo(e.target.value)}
            className={inputClassName}
          >
            <option value="">Ingresos y egresos</option>
            <option value="2">Solo ingresos</option>
            <option value="1">Solo egresos</option>
          </select>
        </div>
      ),
    },
  ];

  // Limitado a su caja y sin caja (nunca abrió una): no se puede generar
  const reportes = todosLosReportes
    .filter((r) => puedeVer(r.key))
    .map((r) =>
      soloSuCaja && cajas.length === 0 && !r.todasLasCajas ? { ...r, disabled: true } : r
    );

  // Búsqueda sin distinguir mayúsculas ni acentos
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termino = normalizar(busqueda.trim());
  const filtrados = reportes.filter(
    (r) => !termino || normalizar(`${r.title} ${r.description}`).includes(termino)
  );

  const rep = reportes.find((r) => r.key === seleccionado) || reportes[0];
  const recientesVisibles = recientes
    .map((r) => ({ ...r, def: reportes.find((d) => d.key === r.key) }))
    .filter((r) => r.def);

  const abrirReciente = (r: Reciente) => {
    const key = r.key as ReporteKey;
    setSeleccionado(key);
    updateF(key, 0, r.desde);
    updateF(key, 1, r.hasta);
  };

  return (
    <div className="w-full lg:h-full lg:flex lg:flex-col">
      <PageHeader
        title="Reportes"
        icon={BarChart3}
        subtitle="Elegí un reporte, ajustá los filtros y generá el PDF"
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start lg:flex-1 lg:min-h-0">
        {/* ── Lista de reportes ── */}
        <aside className="w-full lg:w-80 shrink-0 lg:self-stretch lg:flex lg:flex-col bg-white border border-border rounded-xl shadow-card p-4">
          <div className="relative mb-4">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar reporte..."
              className={`${inputClassName} pl-9 bg-muted`}
            />
          </div>

          {filtrados.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">
              Ningún reporte coincide con “{busqueda.trim()}”.
            </p>
          )}

          <nav className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            {GRUPOS.map((grupo) => {
              const items = filtrados.filter((r) => r.grupo === grupo);
              if (items.length === 0) return null;
              return (
                <div key={grupo}>
                  <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {grupo}
                  </p>
                  {items.map((r) => {
                    const activo = r.key === rep?.key;
                    const Icono = r.icon;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setSeleccionado(r.key)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                          activo
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "text-secondary-foreground hover:bg-muted"
                        }`}
                      >
                        <Icono
                          className={`size-4 shrink-0 ${activo ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {r.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ── Detalle del reporte seleccionado ── */}
        {rep && (
          <section className="flex-1 min-w-0 w-full lg:max-h-full lg:overflow-y-auto bg-white border border-border rounded-xl shadow-card p-6 lg:p-8">
            <div className="flex items-start gap-4 pb-6 mb-6 border-b border-border">
              <div className="p-3 rounded-lg bg-primary-50 shrink-0">
                <rep.icon className="size-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground">{rep.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{rep.description}</p>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                {rep.grupo}
              </span>
            </div>

            <div className="max-w-2xl">
              <DateRange
                fechaInicio={f[rep.key][0]}
                fechaFin={f[rep.key][1]}
                onChangeFechaInicio={(v) => updateF(rep.key, 0, v)}
                onChangeFechaFin={(v) => updateF(rep.key, 1, v)}
              />
              {rep.extra}
              {!rep.sinFiltroCajas && (
                <SelectorCajas
                  cajas={cajas}
                  seleccion={seleccionDe(rep.key)}
                  onToggle={(id) => toggleCajaSel(rep.key, id)}
                  bloqueado={soloSuCaja}
                />
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() =>
                    runReport(
                      rep.key,
                      () => rep.run(f[rep.key][0], f[rep.key][1], cajasFiltroDe(rep.key)),
                      { key: rep.key, desde: f[rep.key][0], hasta: f[rep.key][1] }
                    )
                  }
                  disabled={loading === rep.key || rep.disabled}
                >
                  <FileDown className="size-4" />
                  {loading === rep.key ? "Generando..." : "Generar PDF"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {fechaCorta(f[rep.key][0])} – {fechaCorta(f[rep.key][1])}
                </span>
              </div>
            </div>

            {recientesVisibles.length > 0 && (
              <div className="mt-8 rounded-lg bg-muted p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Generados recientemente
                </p>
                <ul className="space-y-1">
                  {recientesVisibles.map((r) => (
                    <li key={`${r.key}-${r.desde}-${r.hasta}`}>
                      <button
                        type="button"
                        onClick={() => abrirReciente(r)}
                        className="flex items-center gap-2 text-sm hover:text-primary-700"
                      >
                        <History className="size-3.5 text-muted-foreground" />
                        <span className="font-medium text-secondary-foreground">{r.def!.title}</span>
                        <span className="text-muted-foreground">
                          {fechaCorta(r.desde)} – {fechaCorta(r.hasta)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default ReportesPage;
