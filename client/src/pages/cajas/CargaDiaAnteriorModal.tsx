import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Swal from "sweetalert2";
import CampoFecha from "@/components/common/CampoFecha";
import Modal from "../../components/common/Modal";
import ActionButton from "../../components/common/Button/ActionButton";
import ClienteModal from "../../components/common/ClienteModal";
import NominaModal from "../../components/common/NominaModal";
import {
  getDiferencias,
  getGruposAlta,
  previsualizarMovimiento,
  agregarMovimientoACierre,
  type AltaEnCierre,
  type CierreDiferencia,
  type GrupoAlta,
  type VistaPreviaAlta,
} from "../../services/cierrediferencia.service";
import { getAllClientesSinPaginacion } from "../../services/clientes.service";
import { getAllNominasSinPaginacion } from "../../services/nomina.service";
import { getTransportes } from "../../services/transporte.service";
import type { Cliente } from "../../types/cliente.types";
import { formatMiles, formatMilesWithDecimals } from "../../utils/utils";
import { DIAS_TOPE_SUPERVISOR as DIAS_TOPE, primerDiaCargable } from "../../utils/cierreAnterior";
import { esGrupoUsd } from "../../utils/gruposUsd";

export interface CajaOpcion {
  CajaId: number;
  CajaDescripcion: string;
  CajaTipoId?: number | null;
}

type Origen = "MOVIMIENTO" | "WESTERN" | "JSI" | "COLEGIO" | "TRANSPORTE";

// Grupos Western con reglas propias (mismas que WesternPagosTab):
// "USD CON COTIZACION" (pagos 8, envíos 15): se carga el monto en dólares y la
// cotización, y el monto en Gs. es el producto; "USD." (esGrupoUsd): el monto
// va en dólares (con decimales)
const westernConCotizacion = (tipo: number, grupo: number) =>
  (tipo === 1 && grupo === 8) || (tipo === 2 && grupo === 15);

interface Nomina {
  NominaId: number;
  NominaNombre: string;
  NominaApellido: string;
  ColegioId: number;
  ColegioCursoId: number;
  ColegioNombre?: string;
  ColegioCursoNombre?: string;
}

interface Transporte {
  TransporteId: number;
  TransporteNombre: string;
}

const CARGA_VACIA = {
  cajaId: "",
  fecha: "",
  cierreId: "",
  origen: "MOVIMIENTO" as Origen,
  tipo: 2,
  grupo: "",
  monto: "",
  detalle: "",
  motivo: "",
  cliente: null as Cliente | null,
  // Western (mismos campos que WesternPagosTab; tipo 1 pago, 2 envío)
  dolares: "",
  cotizacion: "",
  mtcn: "",
  cargoEnvio: "",
  // Cobranza de colegio (mismos campos que CobranzaColegiosTab)
  nomina: null as Nomina | null,
  mes: "1",
  mesPagado: "",
  diasMora: "",
  examen: "",
  descuento: "",
  // Pago de transporte (mismos campos que EmpresasTransporteTab)
  transporteId: "",
  origenViaje: "",
  destino: "",
  fechaEmbarque: "",
  hora: "",
  asiento: "",
  numeroBoleto: "",
  telefono: "",
  clienteRUC: "",
};

// Fecha local YYYY-MM-DD
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "YYYY-MM-DD HH:MI" -> "dd/mm/yyyy HH:MI"
const formatFechaHora = (f: string) => {
  const [fecha, hora] = f.split(" ");
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}${hora ? ` ${hora}` : ""}`;
};

// Diferencia = teórico - contado: > 0 faltante, < 0 sobrante
const textoDiferencia = (v: string | number) => {
  const n = Number(v);
  if (n === 0) return "sin diferencia";
  return `${n > 0 ? "faltante" : "sobrante"} ${formatMiles(Math.abs(n))}`;
};

const nombreCliente = (c: Cliente) => `${c.ClienteNombre} ${c.ClienteApellido ?? ""}`.trim();

// Cargar en un cierre anterior un movimiento que faltó: un movimiento de caja
// (tipo y grupo de gasto), un cobro de JSI, una cobranza de colegio o un pago
// de transporte (estos tres crean también su cobro/cobranza/pago). Sin
// `cierreFijo` se elige caja, fecha y turno; con él (desde el detalle de un
// cierre) se carga en ese. Antes de guardar muestra lo que va a pasar (cajas
// que se ajustan, posibles duplicados) para confirmarlo. Queda en ese cierre,
// se recalcula su diferencia, la caja del cajero no se toca (ni el turno en
// curso) y las demás cajas del gasto se ajustan.
export default function CargaDiaAnteriorModal({
  isOpen,
  onClose,
  cajas,
  cierreFijo,
  onCargado,
}: {
  isOpen: boolean;
  onClose: () => void;
  cajas: CajaOpcion[];
  cierreFijo?: Pick<CierreDiferencia, "Id" | "CajaDescripcion" | "Fecha" | "UsuarioNombre" | "UsuarioId"> | null;
  onCargado: (cierreId: number) => void;
}) {
  const [carga, setCarga] = useState(CARGA_VACIA);
  const [cierres, setCierres] = useState<CierreDiferencia[]>([]);
  const [buscandoCierres, setBuscandoCierres] = useState(false);
  const [grupos, setGrupos] = useState<{ movimiento: GrupoAlta[]; western: GrupoAlta[] }>({
    movimiento: [],
    western: [],
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showNominaModal, setShowNominaModal] = useState(false);
  const [vista, setVista] = useState<VistaPreviaAlta | null>(null);
  const [procesando, setProcesando] = useState(false);

  const set = (cambios: Partial<typeof CARGA_VACIA>) => setCarga((prev) => ({ ...prev, ...cambios }));
  const cierreId = cierreFijo ? cierreFijo.Id : Number(carga.cierreId);

  useEffect(() => {
    if (!isOpen) return;
    setCarga(CARGA_VACIA);
    setVista(null);
  }, [isOpen]);

  // Las listas se cargan la primera vez que hacen falta
  useEffect(() => {
    if (!isOpen || grupos.movimiento.length > 0) return;
    getGruposAlta()
      .then(setGrupos)
      .catch((err) => console.error("Error al cargar grupos de gasto:", err));
  }, [isOpen, grupos.movimiento.length]);
  useEffect(() => {
    if (carga.origen === "MOVIMIENTO" || carga.origen === "COLEGIO" || clientes.length > 0) return;
    getAllClientesSinPaginacion()
      .then((data: { data?: Cliente[] }) => setClientes(data.data || []))
      .catch((err) => console.error("Error al cargar clientes:", err));
  }, [carga.origen, clientes.length]);
  useEffect(() => {
    if (carga.origen !== "COLEGIO" || nominas.length > 0) return;
    getAllNominasSinPaginacion()
      .then((data: { data?: Nomina[] }) => setNominas(data.data || []))
      .catch((err) => console.error("Error al cargar alumnos:", err));
  }, [carga.origen, nominas.length]);
  useEffect(() => {
    if (carga.origen !== "TRANSPORTE" || transportes.length > 0) return;
    getTransportes(1, 1000)
      .then((data: { data?: Transporte[] }) =>
        setTransportes(
          (data.data || []).sort((a, b) => a.TransporteNombre.localeCompare(b.TransporteNombre))
        )
      )
      .catch((err) => console.error("Error al cargar transportes:", err));
  }, [carga.origen, transportes.length]);

  // Cierres de la caja en ese día (puede haber más de un turno): por defecto
  // el último
  useEffect(() => {
    setCierres([]);
    setCarga((prev) => ({ ...prev, cierreId: "" }));
    if (cierreFijo || !carga.cajaId || !carga.fecha) return;
    let vigente = true;
    setBuscandoCierres(true);
    getDiferencias(1, 50, {
      fechaDesde: carga.fecha,
      fechaHasta: carga.fecha,
      cajaId: carga.cajaId,
      tipo: "",
      sortBy: "Fecha",
      sortOrder: "asc",
    })
      .then((r) => {
        if (!vigente) return;
        setCierres(r.data);
        const ultimo = r.data[r.data.length - 1];
        if (ultimo) setCarga((prev) => ({ ...prev, cierreId: String(ultimo.Id) }));
      })
      .catch((err) => console.error("Error al buscar los cierres del día:", err))
      .finally(() => {
        if (vigente) setBuscandoCierres(false);
      });
    return () => {
      vigente = false;
    };
  }, [cierreFijo, carga.cajaId, carga.fecha]);

  const grupoWestern = Number(carga.grupo);
  const conCotizacion = westernConCotizacion(carga.tipo, grupoWestern);
  const enDolares = esGrupoUsd(carga.tipo, grupoWestern);
  // Monto en Gs. de un Western con cotización: dólares x cotización
  const montoCotizado =
    Math.round((Number(carga.dolares) || 0) * (Number(carga.cotizacion) || 0) * 100) / 100;

  const datos = (): AltaEnCierre => {
    const motivo = carga.motivo;
    switch (carga.origen) {
      case "WESTERN":
        return {
          Origen: "WESTERN",
          TipoGastoId: carga.tipo,
          TipoGastoGrupoId: grupoWestern,
          ClienteId: Number(carga.cliente!.ClienteId),
          RegistroDiarioCajaMonto: conCotizacion ? montoCotizado : Number(carga.monto),
          RegistroDiarioCajaCambio: conCotizacion ? Number(carga.cotizacion) : 0,
          RegistroDiarioCajaMTCN: Number(carga.mtcn),
          RegistroDiarioCajaCargoEnvio: carga.tipo === 2 ? Number(carga.cargoEnvio) || 0 : 0,
          RegistroDiarioCajaDetalle: carga.detalle,
          Motivo: motivo,
        };
      case "JSI":
        return {
          Origen: "JSI",
          ClienteId: Number(carga.cliente!.ClienteId),
          RegistroDiarioCajaMonto: Number(carga.monto),
          Motivo: motivo,
        };
      case "COLEGIO":
        return {
          Origen: "COLEGIO",
          Colegio: {
            nominaId: carga.nomina!.NominaId,
            mes: Number(carga.mes),
            mesPagado: carga.mesPagado,
            diasMora: Number(carga.diasMora) || 0,
            examen: Number(carga.examen) || 0,
            descuento: Number(carga.descuento) || 0,
          },
          Motivo: motivo,
        };
      case "TRANSPORTE":
        return {
          Origen: "TRANSPORTE",
          Transporte: {
            transporteId: Number(carga.transporteId),
            clienteId: carga.cliente ? Number(carga.cliente.ClienteId) : null,
            origen: carga.origenViaje,
            destino: carga.destino,
            fechaEmbarque: carga.fechaEmbarque,
            hora: carga.hora,
            asiento: carga.asiento,
            numeroBoleto: carga.numeroBoleto,
            telefono: carga.telefono,
            clienteRUC: carga.clienteRUC,
          },
          RegistroDiarioCajaMonto: Number(carga.monto),
          Motivo: motivo,
        };
      default:
        return {
          TipoGastoId: carga.tipo,
          TipoGastoGrupoId: Number(carga.grupo),
          RegistroDiarioCajaMonto: Number(carga.monto),
          RegistroDiarioCajaDetalle: carga.detalle,
          Motivo: motivo,
        };
    }
  };

  const avisar = (title: string, err?: unknown) =>
    Swal.fire({
      icon: "warning",
      title,
      text: err ? (err as { message?: string })?.message || "Error desconocido" : undefined,
      confirmButtonColor: "#0d9488",
    });

  // Paso 1: validar en el servidor y mostrar lo que va a pasar
  const revisar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cierreId) return avisar("Elegí el cierre en el que se carga");
    if (carga.origen === "JSI" && !carga.cliente) return avisar("Elegí el cliente del cobro de JSI");
    if (carga.origen === "WESTERN" && !carga.cliente) return avisar("Elegí el cliente del Western");
    if (carga.origen === "WESTERN" && conCotizacion && !(montoCotizado > 0)) {
      return avisar("Indicá el monto en dólares y la cotización");
    }
    if (carga.origen === "COLEGIO" && !carga.nomina) return avisar("Elegí el alumno");
    setProcesando(true);
    try {
      setVista(await previsualizarMovimiento(cierreId, datos()));
    } catch (err) {
      avisar("No se puede cargar", err);
    } finally {
      setProcesando(false);
    }
  };

  // Paso 2: guardar
  const confirmar = async () => {
    setProcesando(true);
    try {
      const respuesta = await agregarMovimientoACierre(cierreId, datos());
      Swal.fire({ icon: "success", title: "Movimiento cargado", text: respuesta.message });
      onClose();
      onCargado(cierreId);
    } catch (err) {
      avisar("No se pudo cargar", err);
    } finally {
      setProcesando(false);
    }
  };

  const campo = "w-full border border-gray-300 rounded-lg p-2 text-sm disabled:bg-gray-50";
  const etiqueta = "block text-xs font-medium text-gray-700 mb-1";
  const cierreElegido = cierreFijo ?? cierres.find((c) => c.Id === cierreId);
  const cajaElegida = cierreFijo
    ? cierreFijo.CajaDescripcion
    : cajas.find((c) => String(c.CajaId) === carga.cajaId)?.CajaDescripcion;

  const selectorCliente = (opcional: boolean) => (
    <div className="sm:col-span-2">
      <span className={etiqueta}>Cliente{opcional && " (opcional)"}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowClienteModal(true)}
          className={`${campo} text-left bg-white hover:bg-gray-50 cursor-pointer`}
        >
          {carga.cliente ? nombreCliente(carga.cliente) : "Elegir cliente..."}
        </button>
        {opcional && carga.cliente && (
          <ActionButton label="Quitar" variant="secondary" onClick={() => set({ cliente: null })} />
        )}
      </div>
    </div>
  );

  const campoMonto = (
    <div>
      <label htmlFor="cargaMonto" className={etiqueta}>
        Monto Gs.
      </label>
      <input
        id="cargaMonto"
        type="number"
        min="1"
        step="any"
        value={carga.monto}
        onChange={(e) => set({ monto: e.target.value })}
        required
        className={campo}
      />
    </div>
  );

  const textoInput = (
    id: string,
    label: string,
    k: keyof typeof CARGA_VACIA,
    maxLength: number,
    opciones: { required?: boolean; mayusculas?: boolean } = {}
  ) => (
    <div>
      <label htmlFor={id} className={etiqueta}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        maxLength={maxLength}
        value={carga[k] as string}
        onChange={(e) =>
          set({ [k]: opciones.mayusculas ? e.target.value.toUpperCase() : e.target.value })
        }
        required={opciones.required}
        className={campo}
      />
    </div>
  );

  const numeroInput = (id: string, label: string, k: keyof typeof CARGA_VACIA, min = "0", max?: string) => (
    <div>
      <label htmlFor={id} className={etiqueta}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step="1"
        value={carga[k] as string}
        onChange={(e) => set({ [k]: e.target.value })}
        className={campo}
      />
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          cierreFijo
            ? `Agregar movimiento faltante — ${cierreFijo.CajaDescripcion}, cierre del ${formatFechaHora(cierreFijo.Fecha)}`
            : "Cargar movimiento de un día anterior"
        }
        size="4xl"
      >
        {vista && cierreElegido ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-900">
              Se va a cargar un{" "}
              <span className={`font-semibold ${vista.tipo === 2 ? "text-success-700" : "text-danger-600"}`}>
                {vista.tipo === 2 ? "INGRESO" : "EGRESO"} de{" "}
                {vista.enDolares
                  ? `USD ${formatMilesWithDecimals(vista.monto)}`
                  : `Gs. ${formatMiles(vista.monto)}`}
              </span>{" "}
              ({vista.grupo}
              {vista.cambio > 0 && `, cotización ${formatMiles(vista.cambio)}`}) en <span className="font-semibold">{cajaElegida}</span>, cierre del{" "}
              {formatFechaHora(cierreElegido.Fecha)} ({cierreElegido.UsuarioNombre || cierreElegido.UsuarioId}).
            </p>
            {carga.origen === "COLEGIO" && (
              <p className="text-sm text-gray-600">
                El total lo calculó el sistema con la cuota del curso, como en la pestaña de colegios.
              </p>
            )}
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-900 mb-1">Cajas que se ajustan</p>
              <ul className="space-y-0.5 text-gray-700">
                <li>
                  {cajaElegida}: <span className="text-gray-500">no cambia (el turno ya se arqueó)</span>
                </li>
                {vista.cajas.map((c) => (
                  <li key={c.CajaId}>
                    {c.CajaDescripcion}:{" "}
                    <span className={c.Ajuste < 0 ? "text-danger-600" : "text-success-700"}>
                      {c.Ajuste < 0 ? "−" : "+"}
                      {Number.isInteger(c.Ajuste)
                        ? formatMiles(Math.abs(c.Ajuste))
                        : formatMilesWithDecimals(Math.abs(c.Ajuste))}
                    </span>
                  </li>
                ))}
                {vista.cajas.length === 0 && (
                  <li className="text-gray-500">Ninguna otra caja tiene asignado este gasto.</li>
                )}
              </ul>
              <p className="mt-2 text-gray-600">
                La diferencia de ese cierre se recalcula y el turno de hoy no cambia.
              </p>
            </div>
            {vista.cierreRevisado && (
              <p className="flex items-start gap-1.5 text-sm text-warning-600">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                Ese cierre ya estaba revisado: al cambiar la diferencia vuelve a quedar pendiente.
              </p>
            )}
            {vista.duplicados.length > 0 && (
              <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-gray-900 mb-1">
                  <AlertTriangle className="size-4" /> ¿Ya está cargado?
                </p>
                <ul className="space-y-0.5 text-gray-700">
                  {vista.duplicados.map((d) => (
                    <li key={`${d.Motivo}-${d.Id}`}>
                      {d.Motivo}: {d.CajaDescripcion ? `${d.CajaDescripcion}, ` : ""}
                      {formatFechaHora(d.Fecha)}
                      {d.Detalle ? ` — ${d.Detalle}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <ActionButton
                label={procesando ? "Cargando..." : "Confirmar y cargar"}
                onClick={confirmar}
                disabled={procesando}
              />
              <ActionButton label="Volver" variant="secondary" onClick={() => setVista(null)} disabled={procesando} />
            </div>
          </div>
        ) : (
          <form onSubmit={revisar} className="space-y-3">
            <p className="text-sm text-gray-600">
              El movimiento queda en el cierre de ese día: se recalcula su diferencia y se ajustan las
              demás cajas del gasto. La caja del cajero no se toca, así que el turno en curso no cambia.
              Sólo cierres de los últimos {DIAS_TOPE} días.
            </p>
            {!cierreFijo && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cargaCaja" className={etiqueta}>
                      Caja
                    </label>
                    <select
                      id="cargaCaja"
                      value={carga.cajaId}
                      onChange={(e) => set({ cajaId: e.target.value })}
                      required
                      className={`${campo} bg-white`}
                    >
                      <option value="">Seleccione...</option>
                      {cajas.map((c) => (
                        <option key={c.CajaId} value={c.CajaId}>
                          {c.CajaDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cargaFecha" className={etiqueta}>
                      Fecha
                    </label>
                    <CampoFecha
                      id="cargaFecha"
                      type="date"
                      value={carga.fecha}
                      min={primerDiaCargable()}
                      max={isoLocal(new Date())}
                      onChange={(e) => set({ fecha: e.target.value })}
                      required
                      className={campo}
                    />
                  </div>
                  <div>
                    <label htmlFor="cargaCierre" className={etiqueta}>
                      Cierre
                    </label>
                    <select
                      id="cargaCierre"
                      value={carga.cierreId}
                      onChange={(e) => set({ cierreId: e.target.value })}
                      required
                      disabled={cierres.length === 0}
                      className={`${campo} bg-white`}
                    >
                      {cierres.length === 0 ? (
                        <option value="">
                          {!carga.cajaId || !carga.fecha
                            ? "Elegí caja y fecha"
                            : buscandoCierres
                              ? "Buscando..."
                              : "Sin cierres ese día"}
                        </option>
                      ) : (
                        cierres.map((c) => (
                          <option key={c.Id} value={c.Id}>
                            {c.Fecha.split(" ")[1]} — {c.UsuarioNombre || c.UsuarioId} (
                            {textoDiferencia(c.Diferencia)})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
                {carga.cajaId && carga.fecha && !buscandoCierres && cierres.length === 0 && (
                  <p className="text-xs text-warning-600">
                    Esa caja no tiene un turno cerrado ese día. Si el turno sigue abierto, el movimiento
                    se carga normalmente desde su pantalla.
                  </p>
                )}
              </>
            )}

            <div>
              <label htmlFor="cargaOrigen" className={etiqueta}>
                Qué falta
              </label>
              <select
                id="cargaOrigen"
                value={carga.origen}
                onChange={(e) =>
                  setCarga((prev) => ({
                    ...CARGA_VACIA,
                    cajaId: prev.cajaId,
                    fecha: prev.fecha,
                    cierreId: prev.cierreId,
                    motivo: prev.motivo,
                    origen: e.target.value as Origen,
                  }))
                }
                className={`${campo} sm:w-auto bg-white`}
              >
                <option value="MOVIMIENTO">Movimiento de caja (tipo y grupo de gasto)</option>
                <option value="WESTERN">Western (pago o envío)</option>
                <option value="COLEGIO">Cobranza de colegio</option>
                <option value="TRANSPORTE">Pago de transporte</option>
                <option value="JSI">Cobro de JSI</option>
              </select>
            </div>

            {carga.origen === "MOVIMIENTO" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cargaTipo" className={etiqueta}>
                      Tipo de gasto
                    </label>
                    <select
                      id="cargaTipo"
                      value={carga.tipo}
                      onChange={(e) => set({ tipo: Number(e.target.value), grupo: "" })}
                      className={`${campo} bg-white`}
                    >
                      <option value={2}>Ingreso</option>
                      <option value={1}>Egreso</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cargaGrupo" className={etiqueta}>
                      Grupo de gasto
                    </label>
                    <select
                      id="cargaGrupo"
                      value={carga.grupo}
                      onChange={(e) => set({ grupo: e.target.value })}
                      required
                      className={`${campo} bg-white`}
                    >
                      <option value="">Seleccione...</option>
                      {grupos.movimiento
                        .filter((g) => g.TipoGastoId === carga.tipo)
                        .map((g) => (
                          <option key={g.TipoGastoGrupoId} value={g.TipoGastoGrupoId}>
                            {g.TipoGastoGrupoDescripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  {campoMonto}
                </div>
                {textoInput("cargaDetalle", "Descripción", "detalle", 250)}
                <p className="text-xs text-gray-500">
                  Los grupos de colegios, transporte, Western y JSI se cargan con su opción en "Qué
                  falta"; los de divisas y pases, desde su pestaña.
                </p>
              </>
            )}

            {carga.origen === "WESTERN" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cargaTipoWestern" className={etiqueta}>
                      Tipo
                    </label>
                    <select
                      id="cargaTipoWestern"
                      value={carga.tipo}
                      onChange={(e) =>
                        set({ tipo: Number(e.target.value), grupo: "", monto: "", dolares: "", cotizacion: "", cargoEnvio: "" })
                      }
                      className={`${campo} bg-white`}
                    >
                      <option value={1}>Pago (egreso)</option>
                      <option value={2}>Envío (ingreso)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="cargaGrupoWestern" className={etiqueta}>
                      Grupo
                    </label>
                    <select
                      id="cargaGrupoWestern"
                      value={carga.grupo}
                      onChange={(e) => set({ grupo: e.target.value, monto: "", dolares: "", cotizacion: "" })}
                      required
                      className={`${campo} bg-white`}
                    >
                      <option value="">Seleccione...</option>
                      {grupos.western
                        .filter((g) => g.TipoGastoId === carga.tipo)
                        .map((g) => (
                          <option key={g.TipoGastoGrupoId} value={g.TipoGastoGrupoId}>
                            {g.TipoGastoGrupoDescripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectorCliente(false)}
                  <div>
                    <label htmlFor="cargaMTCN" className={etiqueta}>
                      MTCN
                    </label>
                    <input
                      id="cargaMTCN"
                      type="number"
                      min="1"
                      step="1"
                      value={carga.mtcn}
                      onChange={(e) => set({ mtcn: e.target.value })}
                      required
                      className={campo}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {conCotizacion ? (
                    <>
                      <div>
                        <label htmlFor="cargaDolares" className={etiqueta}>
                          Monto USD
                        </label>
                        <input
                          id="cargaDolares"
                          type="number"
                          min="0.01"
                          step="any"
                          value={carga.dolares}
                          onChange={(e) => set({ dolares: e.target.value })}
                          required
                          className={campo}
                        />
                      </div>
                      <div>
                        <label htmlFor="cargaCotizacion" className={etiqueta}>
                          Cotización de ese día
                        </label>
                        <input
                          id="cargaCotizacion"
                          type="number"
                          min="1"
                          step="any"
                          value={carga.cotizacion}
                          onChange={(e) => set({ cotizacion: e.target.value })}
                          required
                          className={campo}
                        />
                      </div>
                      <div>
                        <span className={etiqueta}>Monto Gs.</span>
                        <p className="p-2 text-sm font-medium text-gray-900">
                          {montoCotizado > 0 ? formatMiles(montoCotizado) : "—"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label htmlFor="cargaMontoWestern" className={etiqueta}>
                        {enDolares ? "Monto USD" : "Monto Gs."}
                      </label>
                      <input
                        id="cargaMontoWestern"
                        type="number"
                        min={enDolares ? "0.01" : "1"}
                        step="any"
                        value={carga.monto}
                        onChange={(e) => set({ monto: e.target.value })}
                        required
                        className={campo}
                      />
                    </div>
                  )}
                  {carga.tipo === 2 && (
                    <div>
                      <label htmlFor="cargaCargoEnvio" className={etiqueta}>
                        Cargo envío
                      </label>
                      <input
                        id="cargaCargoEnvio"
                        type="number"
                        min="0"
                        step="any"
                        value={carga.cargoEnvio}
                        onChange={(e) => set({ cargoEnvio: e.target.value })}
                        className={campo}
                      />
                    </div>
                  )}
                </div>
                {textoInput("cargaDetalleWestern", "Descripción", "detalle", 250)}
              </>
            )}

            {carga.origen === "JSI" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectorCliente(false)}
                {campoMonto}
              </div>
            )}

            {carga.origen === "COLEGIO" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <span className={etiqueta}>Alumno</span>
                    <button
                      type="button"
                      onClick={() => setShowNominaModal(true)}
                      className={`${campo} text-left bg-white hover:bg-gray-50 cursor-pointer`}
                    >
                      {carga.nomina
                        ? `${carga.nomina.NominaApellido}, ${carga.nomina.NominaNombre}${
                            carga.nomina.ColegioNombre ? ` — ${carga.nomina.ColegioNombre}` : ""
                          }`
                        : "Elegir alumno..."}
                    </button>
                  </div>
                  {textoInput("cargaMesPagado", "Mes pagado", "mesPagado", 30, { required: true, mayusculas: true })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numeroInput("cargaMes", "Cantidad de meses", "mes", "1", "12")}
                  {numeroInput("cargaDiasMora", "Días de mora", "diasMora")}
                  {numeroInput("cargaExamen", "Examen Gs.", "examen")}
                  {numeroInput("cargaDescuento", "Descuento Gs.", "descuento")}
                </div>
                <p className="text-xs text-gray-500">
                  El total se calcula como en la pestaña de colegios: cuota del curso × meses + mora
                  (1.000 por día) + examen − descuento. Se muestra antes de confirmar.
                </p>
              </>
            )}

            {carga.origen === "TRANSPORTE" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cargaTransporte" className={etiqueta}>
                      Empresa
                    </label>
                    <select
                      id="cargaTransporte"
                      value={carga.transporteId}
                      onChange={(e) => set({ transporteId: e.target.value })}
                      required
                      className={`${campo} bg-white`}
                    >
                      <option value="">Seleccione...</option>
                      {transportes.map((t) => (
                        <option key={t.TransporteId} value={t.TransporteId}>
                          {t.TransporteNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {textoInput("cargaOrigenViaje", "Origen", "origenViaje", 30, { required: true, mayusculas: true })}
                  {textoInput("cargaDestino", "Destino", "destino", 30, { required: true, mayusculas: true })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label htmlFor="cargaEmbarque" className={etiqueta}>
                      Fecha de embarque
                    </label>
                    <CampoFecha
                      id="cargaEmbarque"
                      type="date"
                      value={carga.fechaEmbarque}
                      onChange={(e) => set({ fechaEmbarque: e.target.value })}
                      className={campo}
                    />
                  </div>
                  <div>
                    <label htmlFor="cargaHora" className={etiqueta}>
                      Hora
                    </label>
                    <input
                      id="cargaHora"
                      type="time"
                      value={carga.hora}
                      onChange={(e) => set({ hora: e.target.value })}
                      className={campo}
                    />
                  </div>
                  {textoInput("cargaAsiento", "Asiento", "asiento", 5)}
                  {textoInput("cargaBoleto", "N° de boleto", "numeroBoleto", 20)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectorCliente(true)}
                  {campoMonto}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {textoInput("cargaTelefono", "Teléfono", "telefono", 20)}
                  {textoInput("cargaRUC", "RUC", "clienteRUC", 20)}
                </div>
              </>
            )}

            {textoInput("cargaMotivo", "Motivo", "motivo", 500, { required: true })}

            <div className="flex gap-2">
              <ActionButton
                label={procesando ? "Revisando..." : "Revisar antes de cargar"}
                type="submit"
                disabled={procesando || !cierreId}
              />
              <ActionButton label="Cancelar" variant="secondary" onClick={onClose} />
            </div>
          </form>
        )}
      </Modal>

      <ClienteModal
        show={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        clientes={clientes}
        onSelect={(cliente) => {
          setCarga((prev) => ({
            ...prev,
            cliente,
            // En un pasaje se toman el teléfono y el RUC del cliente (como
            // EmpresasTransporteTab)
            ...(prev.origen === "TRANSPORTE"
              ? {
                  telefono: (cliente.ClienteTelefono || "").slice(0, 20),
                  clienteRUC: (cliente.ClienteRUC || "").slice(0, 20),
                }
              : {}),
          }));
          setShowClienteModal(false);
        }}
      />
      <NominaModal
        show={showNominaModal}
        onClose={() => setShowNominaModal(false)}
        nominas={nominas}
        onSelect={(nomina) => {
          set({ nomina });
          setShowNominaModal(false);
        }}
      />
    </>
  );
}
