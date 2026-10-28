import { Scale, AlertTriangle, CheckCircle2, Search, History, Plus } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import CampoFecha from "@/components/common/CampoFecha";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import Modal from "../../components/common/Modal";
import ActionButton from "../../components/common/Button/ActionButton";
import DataTable from "../../components/common/Table/DataTable";
import {
  getDiferencias,
  getDiferenciaDetalle,
  updateDiferenciaRevision,
  type CierreDiferencia,
  type CierreDiferenciaDetalle,
  type FiltrosDiferencias,
  type TotalesDiferencias,
} from "../../services/cierrediferencia.service";
import { getCajas } from "../../services/cajas.service";
import { usePermiso } from "../../hooks/usePermiso";
import { formatMiles } from "../../utils/utils";
import CargaDiaAnteriorModal, { type CajaOpcion } from "./CargaDiaAnteriorModal";
import { DIAS_TOPE_SUPERVISOR, primerDiaCargable } from "../../utils/cierreAnterior";

type Fila = CierreDiferencia & { id: number; [key: string]: unknown };

// "YYYY-MM-DD HH:MI" -> "dd/mm/yyyy HH:MI", sin pasar por Date (sin corrimiento
// de zona horaria)
const formatFechaHora = (f: string | null) => {
  if (!f) return "";
  const [fecha, hora] = f.split(" ");
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}${hora ? ` ${hora}` : ""}`;
};

// Fecha local YYYY-MM-DD
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Por defecto, el mes en curso: la historia de los primeros meses tiene cierres
// de prueba con diferencias enormes que taparían los totales.
const hoy = new Date();
const FILTROS_INICIALES: FiltrosDiferencias = {
  fechaDesde: isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
  fechaHasta: isoLocal(hoy),
  cajaId: "",
  tipo: "con",
  revisado: "",
};

// Diferencia = teórico - contado: > 0 faltante, < 0 sobrante
function DiferenciaBadge({ monto }: { monto: number }) {
  if (monto === 0) return <span className="text-gray-500">Sin diferencia</span>;
  const faltante = monto > 0;
  return (
    <span
      className={`font-semibold ${faltante ? "text-danger-600" : "text-success-700"}`}
    >
      {faltante ? "Faltante" : "Sobrante"} {formatMiles(Math.abs(monto))}
    </span>
  );
}

// La diferencia se recalculó porque se corrigieron/eliminaron movimientos del
// turno después del cierre
function BadgeCorrecciones({ cantidad }: { cantidad: number }) {
  return (
    <span
      className="flex items-center gap-1 text-xs font-medium text-primary"
      title="Se corrigieron o eliminaron movimientos de este turno después del cierre"
    >
      <History className="size-3.5" /> Recalculada ({cantidad})
    </span>
  );
}

const formatDif = (v: string | number | null) =>
  v === null ? "—" : formatMiles(Number(v));

export default function DiferenciasCierrePage() {
  const puedeLeer = usePermiso("CIERREDIFERENCIAS", "leer");
  const puedeEditar = usePermiso("CIERREDIFERENCIAS", "editar");

  const [rows, setRows] = useState<CierreDiferencia[]>([]);
  const [totales, setTotales] = useState<TotalesDiferencias | null>(null);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1, itemsPerPage: 0 });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filtros, setFiltros] = useState<FiltrosDiferencias>(FILTROS_INICIALES);
  const [aplicados, setAplicados] = useState<FiltrosDiferencias>(FILTROS_INICIALES);
  const [sortKey, setSortKey] = useState("Fecha");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [cajas, setCajas] = useState<CajaOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detalle, setDetalle] = useState<CierreDiferenciaDetalle | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [revisado, setRevisado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Modal de carga: abierto desde el botón general (sin cierre) o desde el
  // detalle de un cierre (fijado en ese)
  const [cargaAbierta, setCargaAbierta] = useState(false);
  const [cargaEnCierre, setCargaEnCierre] = useState<CierreDiferenciaDetalle | null>(null);

  const cargar = useCallback(async () => {
    if (!puedeLeer) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getDiferencias(page, itemsPerPage, {
        ...aplicados,
        sortBy: sortKey,
        sortOrder,
      });
      setRows(result.data);
      setTotales(result.totales);
      setPagination(result.pagination);
    } catch (err) {
      setError((err as { message?: string })?.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [puedeLeer, page, itemsPerPage, aplicados, sortKey, sortOrder]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Sólo las cajas internas trabajan por turnos de apertura/cierre
  useEffect(() => {
    if (!puedeLeer) return;
    getCajas(1, 1000)
      .then((data: { data: CajaOpcion[] }) =>
        setCajas((data.data || []).filter((c) => c.CajaTipoId === 1)),
      )
      .catch((err) => console.error("Error al cargar cajas:", err));
  }, [puedeLeer]);

  const setFiltro = <K extends keyof FiltrosDiferencias>(k: K, v: FiltrosDiferencias[K]) =>
    setFiltros((prev) => ({ ...prev, [k]: v }));

  const aplicar = () => {
    setAplicados(filtros);
    setPage(1);
  };

  const limpiar = () => {
    setFiltros(FILTROS_INICIALES);
    setAplicados(FILTROS_INICIALES);
    setPage(1);
  };

  const abrirDetalle = async (id: number) => {
    setDetalleAbierto(true);
    setDetalleLoading(true);
    setDetalle(null);
    try {
      const d = await getDiferenciaDetalle(id);
      setDetalle(d);
      setObservacion(d.Observacion || "");
      setRevisado(d.Revisado);
    } catch (err) {
      setError((err as { message?: string })?.message || "Error al cargar el detalle");
      setDetalleAbierto(false);
    } finally {
      setDetalleLoading(false);
    }
  };

  const guardarRevision = async () => {
    if (!detalle) return;
    setGuardando(true);
    try {
      const d = await updateDiferenciaRevision(detalle.Id, observacion, revisado);
      setDetalle(d);
      setDetalleAbierto(false);
      Swal.fire({
        icon: "success",
        title: "Revisión guardada",
        timer: 1500,
        showConfirmButton: false,
      });
      cargar();
    } catch (err) {
      Swal.fire({
        icon: "warning",
        title: "No se pudo guardar",
        text: (err as { message?: string })?.message || "Error desconocido",
        confirmButtonColor: "#0d9488",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (!puedeLeer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver esta sección.</p>
      </div>
    );
  }

  const data: Fila[] = rows.map((r) => ({ ...r, id: r.Id }));

  const columns = [
    {
      key: "Fecha",
      label: "Cierre",
      render: (r: Fila) => formatFechaHora(r.Fecha),
    },
    { key: "CajaDescripcion", label: "Caja", render: (r: Fila) => r.CajaDescripcion },
    {
      key: "UsuarioNombre",
      label: "Cajero",
      render: (r: Fila) => r.UsuarioNombre || r.UsuarioId,
    },
    {
      key: "Teorico",
      label: "Teórico Gs.",
      render: (r: Fila) => formatMiles(Number(r.Teorico)),
    },
    {
      key: "Contado",
      label: "Contado Gs.",
      render: (r: Fila) => formatMiles(Number(r.Contado)),
    },
    {
      key: "Diferencia",
      label: "Diferencia Gs.",
      render: (r: Fila) => <DiferenciaBadge monto={Number(r.Diferencia)} />,
    },
    {
      key: "Revisado",
      label: "Revisión",
      render: (r: Fila) =>
        Number(r.Diferencia) === 0 ? (
          r.CantCorrecciones > 0 ? (
            <BadgeCorrecciones cantidad={r.CantCorrecciones} />
          ) : (
            <span className="text-gray-400">—</span>
          )
        ) : (
          <div className="max-w-56">
            {r.CantCorrecciones > 0 && (
              <BadgeCorrecciones cantidad={r.CantCorrecciones} />
            )}
            {r.Revisado ? (
              <span className="inline-flex items-center gap-1 text-success-700 text-xs font-medium">
                <CheckCircle2 className="size-3.5" /> Revisado
              </span>
            ) : (
              <span className="text-warning-600 text-xs font-medium">Pendiente</span>
            )}
            {r.Observacion && (
              <p className="text-xs text-gray-500 truncate" title={r.Observacion}>
                {r.Observacion}
              </p>
            )}
          </div>
        ),
    },
  ];

  const tarjeta = (titulo: string, valor: string, detalleTxt: string, color: string) => (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs font-medium text-gray-500">{titulo}</p>
      <p className={`text-lg font-semibold ${color}`}>{valor}</p>
      <p className="text-xs text-gray-500">{detalleTxt}</p>
    </div>
  );

  const abs = detalle ? Math.abs(Number(detalle.Diferencia)) : 0;
  const coincidenciasTurno = detalle?.movimientos.filter((m) => m.Coincidencia) ?? [];
  const corregidos = new Set(detalle?.correcciones.map((c) => c.MovimientoId) ?? []);
  const textoCoincidencia = (c: "MISMO_MONTO" | "MITAD") =>
    c === "MISMO_MONTO"
      ? "Mismo monto que la diferencia: ¿cargado de más o dos veces?"
      : "La diferencia es el doble de este monto: ¿cargado como ingreso en vez de egreso, o al revés?";

  return (
    <div className="w-full">
      <PageHeader
        title="Diferencias de Cierre"
        subtitle="Sobrantes y faltantes de cada cierre de caja"
        icon={Scale}
        actions={
          puedeEditar && (
            <ActionButton
              label="Cargar movimiento de un día anterior"
              icon={Plus}
              onClick={() => {
                setCargaEnCierre(null);
                setCargaAbierta(true);
              }}
            />
          )
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label htmlFor="fechaDesde" className="block text-xs font-medium text-gray-700 mb-1">
              Desde
            </label>
            <CampoFecha
              id="fechaDesde"
              type="date"
              value={filtros.fechaDesde || ""}
              onChange={(e) => setFiltro("fechaDesde", e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fechaHasta" className="block text-xs font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <CampoFecha
              id="fechaHasta"
              type="date"
              value={filtros.fechaHasta || ""}
              onChange={(e) => setFiltro("fechaHasta", e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="cajaId" className="block text-xs font-medium text-gray-700 mb-1">
              Caja
            </label>
            <select
              id="cajaId"
              value={filtros.cajaId || ""}
              onChange={(e) => setFiltro("cajaId", e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
            >
              <option value="">Todas las cajas</option>
              {cajas.map((c) => (
                <option key={c.CajaId} value={c.CajaId}>
                  {c.CajaDescripcion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tipo" className="block text-xs font-medium text-gray-700 mb-1">
              Diferencia
            </label>
            <select
              id="tipo"
              value={filtros.tipo || ""}
              onChange={(e) => setFiltro("tipo", e.target.value as FiltrosDiferencias["tipo"])}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
            >
              <option value="con">Con diferencia</option>
              <option value="faltante">Solo faltantes</option>
              <option value="sobrante">Solo sobrantes</option>
              <option value="">Todos los cierres</option>
            </select>
          </div>
          <div>
            <label htmlFor="revisado" className="block text-xs font-medium text-gray-700 mb-1">
              Revisión
            </label>
            <select
              id="revisado"
              value={filtros.revisado || ""}
              onChange={(e) =>
                setFiltro("revisado", e.target.value as FiltrosDiferencias["revisado"])
              }
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
            >
              <option value="">Todas</option>
              <option value="N">Pendientes</option>
              <option value="S">Revisadas</option>
            </select>
          </div>
          <div className="flex gap-2">
            <ActionButton label="Filtrar" onClick={aplicar} />
            <ActionButton label="Limpiar" variant="secondary" onClick={limpiar} />
          </div>
        </div>
      </div>

      {totales && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {tarjeta(
            "Faltantes",
            formatMiles(Number(totales.TotalFaltantes)),
            `${totales.CantFaltantes} cierre(s)`,
            "text-danger-600",
          )}
          {tarjeta(
            "Sobrantes",
            formatMiles(Number(totales.TotalSobrantes)),
            `${totales.CantSobrantes} cierre(s)`,
            "text-success-700",
          )}
          {tarjeta(
            "Pendientes de revisar",
            String(totales.CantPendientes),
            "con diferencia y sin revisar",
            "text-warning-600",
          )}
        </div>
      )}

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        <DataTable<Fila>
          columns={columns}
          data={data}
          emptyMessage="No hay cierres con esos filtros"
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={(k, o) => {
            setSortKey(k);
            setSortOrder(o);
            setPage(1);
          }}
          customActions={(r) => (
            <button
              type="button"
              className="text-primary hover:underline text-xs cursor-pointer"
              onClick={() => abrirDetalle(r.Id)}
            >
              {puedeEditar && Number(r.Diferencia) !== 0 ? "Revisar" : "Ver detalle"}
            </button>
          )}
        />
      </div>

      <Pagination
        currentPage={page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setPage(1);
        }}
        totalItems={pagination.totalItems}
        currentItems={pagination.itemsPerPage}
      />

      <Modal
        isOpen={detalleAbierto}
        onClose={() => setDetalleAbierto(false)}
        title={
          detalle
            ? `${detalle.CajaDescripcion} — cierre del ${formatFechaHora(detalle.Fecha)}`
            : "Detalle del cierre"
        }
        size="6xl"
      >
        {detalleLoading || !detalle ? (
          <p className="text-center text-gray-500 py-6">Cargando detalle...</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
              {[
                ["Cajero", detalle.UsuarioNombre || detalle.UsuarioId],
                ["Apertura", formatMiles(Number(detalle.Apertura))],
                ["+ Ingresos", formatMiles(Number(detalle.Ingresos))],
                ["− Egresos", formatMiles(Number(detalle.Egresos))],
                ["= Teórico", formatMiles(Number(detalle.Teorico))],
                ["Contado", formatMiles(Number(detalle.Contado))],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{k}</p>
                  <p className="font-medium text-gray-900">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-base">
              <DiferenciaBadge monto={Number(detalle.Diferencia)} />
            </p>

            {abs > 0 && (
              <div className="border border-warning-100 bg-warning-50 rounded-lg p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                  <Search className="size-4" /> Posibles coincidencias con{" "}
                  {formatMiles(abs)}
                </p>
                {coincidenciasTurno.length === 0 && detalle.otrasCajas.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No hay movimientos con ese monto en el turno ni en otras cajas ese día.
                    Probablemente sea un movimiento que no se cargó.
                  </p>
                ) : (
                  <ul className="text-sm text-gray-700 space-y-1">
                    {coincidenciasTurno.map((m) => (
                      <li key={m.Id}>
                        <span className="font-medium">
                          {m.Tipo} {formatMiles(Number(m.Monto))}
                        </span>{" "}
                        — {m.Grupo || m.Detalle} ({formatFechaHora(m.Fecha)}, {m.UsuarioId}).{" "}
                        <span className="text-gray-500">
                          {m.Coincidencia && textoCoincidencia(m.Coincidencia)}
                        </span>
                      </li>
                    ))}
                    {detalle.otrasCajas.map((m) => (
                      <li key={m.Id}>
                        <span className="font-medium">
                          {m.Tipo} {formatMiles(Number(m.Monto))}
                        </span>{" "}
                        en <span className="font-medium">{m.CajaDescripcion}</span> —{" "}
                        {m.Grupo || m.Detalle} ({formatFechaHora(m.Fecha)}, {m.UsuarioId}).{" "}
                        <span className="text-gray-500">¿Cargado en otra caja?</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">
                Movimientos del turno ({detalle.movimientos.length})
              </p>
              <div className="rounded-lg border border-gray-200 overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-3 py-2">Hora</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Concepto</th>
                      <th className="px-3 py-2">Detalle</th>
                      <th className="px-3 py-2">Usuario</th>
                      <th className="px-3 py-2 text-right">Monto Gs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detalle.movimientos.map((m) => (
                      <tr
                        key={m.Id}
                        className={
                          m.Coincidencia
                            ? "bg-warning-50"
                            : m.EsTurno
                              ? "bg-gray-50 text-gray-500"
                              : ""
                        }
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {m.Fecha.split(" ")[1]}
                        </td>
                        <td
                          className={`px-3 py-1.5 ${m.Tipo === "INGRESO" ? "text-success-700" : "text-danger-600"}`}
                        >
                          {m.Tipo}
                        </td>
                        <td className="px-3 py-1.5">{m.Grupo}</td>
                        <td className="px-3 py-1.5">
                          {m.Detalle}
                          {m.AgregadoDespues && (
                            <span className="ml-1.5 text-xs font-medium text-primary">
                              (agregado después del cierre)
                            </span>
                          )}
                          {corregidos.has(m.Id) && !m.AgregadoDespues && (
                            <span className="ml-1.5 text-xs font-medium text-primary">
                              (corregido)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{m.UsuarioId}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {formatMiles(Number(m.Monto))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {detalle.correcciones.length > 0 && (
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                  <History className="size-4" /> Correcciones después del cierre (
                  {detalle.correcciones.length})
                </p>
                <div className="rounded-lg border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Mov.</th>
                        <th className="px-3 py-2">Cambio</th>
                        <th className="px-3 py-2 text-right">Diferencia</th>
                        <th className="px-3 py-2">Motivo</th>
                        <th className="px-3 py-2">Usuario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detalle.correcciones.map((c) => (
                        <tr key={c.Id}>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {formatFechaHora(c.Fecha)}
                          </td>
                          <td className="px-3 py-1.5" title={c.DetalleAnterior || ""}>
                            #{c.MovimientoId}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {c.Tipo === "ELIMINACION"
                              ? `Eliminado (${formatMiles(Number(c.MontoAnterior))})`
                              : c.Tipo === "ALTA"
                                ? `Agregado (${formatDif(c.MontoNuevo)})`
                                : `${formatMiles(Number(c.MontoAnterior))} → ${formatDif(c.MontoNuevo)}`}
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            {formatDif(c.DiferenciaAnterior)} → {formatDif(c.DiferenciaNueva)}
                          </td>
                          <td className="px-3 py-1.5">{c.Motivo}</td>
                          <td className="px-3 py-1.5">{c.UsuarioNombre || c.UsuarioId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {puedeEditar && (
              <div className="border border-gray-200 rounded-lg p-3">
                {detalle.Fecha.slice(0, 10) >= primerDiaCargable() ? (
                  <button
                    type="button"
                    className="text-primary hover:underline text-sm cursor-pointer"
                    onClick={() => {
                      setCargaEnCierre(detalle);
                      setDetalleAbierto(false);
                      setCargaAbierta(true);
                    }}
                  >
                    + Agregar movimiento faltante a este cierre
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Sólo se agregan movimientos a cierres de los últimos {DIAS_TOPE_SUPERVISOR} días.
                  </p>
                )}
              </div>
            )}

            {abs > 0 && (
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div>
                  <label
                    htmlFor="observacion"
                    className="block text-sm font-medium text-gray-900 mb-1"
                  >
                    Observación
                  </label>
                  <textarea
                    id="observacion"
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    maxLength={500}
                    rows={2}
                    disabled={!puedeEditar}
                    placeholder="Ej.: faltó cargar el pago de ... por 150.000"
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-50"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={revisado}
                      onChange={(e) => setRevisado(e.target.checked)}
                      disabled={!puedeEditar}
                      className="size-4"
                    />
                    Revisado
                    {detalle.Revisado && detalle.RevisadoPor && (
                      <span className="text-xs text-gray-500">
                        (por {detalle.RevisadoPor} el {formatFechaHora(detalle.RevisadoFecha)})
                      </span>
                    )}
                  </label>
                  {puedeEditar && (
                    <ActionButton
                      label={guardando ? "Guardando..." : "Guardar revisión"}
                      onClick={guardarRevision}
                      disabled={guardando}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <CargaDiaAnteriorModal
        isOpen={cargaAbierta}
        onClose={() => {
          setCargaAbierta(false);
          // Abierto desde un detalle: se vuelve a él
          if (cargaEnCierre) setDetalleAbierto(true);
        }}
        cajas={cajas}
        cierreFijo={cargaEnCierre}
        onCargado={(cierreId) => {
          cargar();
          abrirDetalle(cierreId);
        }}
      />
    </div>
  );
}
