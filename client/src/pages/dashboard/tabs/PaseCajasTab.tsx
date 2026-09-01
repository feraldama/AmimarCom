import { useState, useEffect } from "react";
import CampoFecha from "@/components/common/CampoFecha";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById, getCajas } from "../../../services/cajas.service";
import { createPaseCaja } from "../../../services/registros.service";
import { getTiposGasto } from "../../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../../services/tipogastogrupo.service";
import Swal from "sweetalert2";
import { formatMiles } from "../../../utils/utils";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  CajaTipoId?: number | null;
  [key: string]: unknown;
}

interface TipoGasto {
  TipoGastoId: number;
  TipoGastoDescripcion: string;
}

interface TipoGastoGrupo {
  TipoGastoGrupoId: number;
  TipoGastoGrupoDescripcion: string;
  TipoGastoId: number;
}

export default function PaseCajasTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);
  const [cajasTipo1, setCajasTipo1] = useState<Caja[]>([]);

  // Formulario Egreso: aperturada → destino. TipoGastoId fijo en 1.
  // El TipoGastoGrupoId se resuelve dinámicamente según la caja seleccionada
  // (convención: descripción "PASE <CajaDescripcion>").
  const [cajaIdEgreso, setCajaIdEgreso] = useState<string | number>("");
  const [fechaEgreso, setFechaEgreso] = useState("");
  const tipoGastoIdEgreso = 1; // Fijo en 1 (Egreso)
  const [detalleEgreso, setDetalleEgreso] = useState("");
  const [montoEgreso, setMontoEgreso] = useState<number | "">("");
  const [cajaSeleccionadaEgreso, setCajaSeleccionadaEgreso] = useState<
    string | number
  >("");

  // Formulario Ingreso: origen → aperturada. TipoGastoId fijo en 2.
  const [cajaIdIngreso, setCajaIdIngreso] = useState<string | number>("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const tipoGastoIdIngreso = 2; // Fijo en 2 (Ingreso)
  const [detalleIngreso, setDetalleIngreso] = useState("");
  const [montoIngreso, setMontoIngreso] = useState<number | "">("");
  const [cajaSeleccionadaIngreso, setCajaSeleccionadaIngreso] = useState<
    string | number
  >("");

  const [isSubmittingEgreso, setIsSubmittingEgreso] = useState(false);
  const [isSubmittingIngreso, setIsSubmittingIngreso] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener caja aperturada
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
          setCajaIdEgreso(estado.cajaId);
          setCajaIdIngreso(estado.cajaId);
        } else {
          setCajaAperturada(null);
        }

        // Obtener tipos de gasto y grupos
        const tiposGastoData = await getTiposGasto();
        setTiposGasto(tiposGastoData);
        const tiposGastoGrupoData = await getTiposGastoGrupo();
        setTiposGastoGrupo(tiposGastoGrupoData);

        // Obtener cajas con CajaTipoId = 1
        const cajasData = await getCajas(1, 1000);
        const cajasFiltradas = cajasData.data.filter(
          (caja: Caja) => caja.CajaTipoId === 1
        );
        setCajasTipo1(cajasFiltradas);

        // Inicializar fecha actual
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        const fechaInicial = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        setFechaEgreso(fechaInicial);
        setFechaIngreso(fechaInicial);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  // Mapeo override para cajas que NO siguen la convención "PASE <descripcion>".
  // Ej: CAJA AMIL usa el grupo "PASE JEFE" en vez de "PASE CAJA AMIL".
  const PASE_GRUPO_OVERRIDE: Record<string, string> = {
    "CAJA AMIL": "PASE JEFE",
  };

  // Resuelve el grupo PASE para una caja dada y un TipoGastoId (1=Egreso, 2=Ingreso).
  // Convención por defecto: descripción del grupo === "PASE <CajaDescripcion>".
  // Si la caja está en PASE_GRUPO_OVERRIDE, usa ese nombre.
  const getPaseGrupo = (
    caja: Caja | undefined,
    tipoGastoId: number
  ): TipoGastoGrupo | undefined => {
    if (!caja) return undefined;
    const desc = caja.CajaDescripcion.trim().toUpperCase();
    const target = PASE_GRUPO_OVERRIDE[desc] ?? `PASE ${desc}`;
    return tiposGastoGrupo.find(
      (g) =>
        g.TipoGastoId === tipoGastoId &&
        g.TipoGastoGrupoDescripcion.trim().toUpperCase() === target
    );
  };

  // Una caja participa del Pase de Cajas sólo si tiene grupo PASE en
  // ambos TipoGastoId (puede ser origen y destino).
  const cajasConPase = cajasTipo1.filter(
    (c) =>
      getPaseGrupo(c, 1) !== undefined && getPaseGrupo(c, 2) !== undefined
  );

  const grupoEgresoForm = getPaseGrupo(
    cajasTipo1.find((c) => Number(c.CajaId) === Number(cajaSeleccionadaEgreso)),
    1
  );
  const grupoIngresoForm = getPaseGrupo(
    cajasTipo1.find(
      (c) => Number(c.CajaId) === Number(cajaSeleccionadaIngreso)
    ),
    2
  );

  const handleSubmitEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEgreso) return;
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar egresos.",
        confirmButtonColor: "#0d9488",
      });
      return;
    }

    setIsSubmittingEgreso(true);
    try {
      if (!cajaSeleccionadaEgreso) {
        Swal.fire({
          icon: "warning",
          title: "Caja no seleccionada",
          text: "Debes seleccionar una caja destino.",
          confirmButtonColor: "#0d9488",
        });
        return;
      }

      // Resolver grupos PASE dinámicamente según las cajas involucradas:
      //  - aperturada (origen del egreso) -> grupo "PASE <destino>" en TipoGasto=1
      //  - destino (recibe el ingreso)    -> grupo "PASE <aperturada>" en TipoGasto=2
      const cajaDestino = cajasTipo1.find(
        (c) => Number(c.CajaId) === Number(cajaSeleccionadaEgreso)
      );
      const grupoEgresoAperturada = getPaseGrupo(cajaDestino, 1);
      const grupoIngresoDestino = getPaseGrupo(cajaAperturada, 2);

      if (!grupoEgresoAperturada || !grupoIngresoDestino) {
        Swal.fire({
          icon: "warning",
          title: "Grupo PASE no configurado",
          text: "Falta el grupo 'PASE <CajaDescripcion>' en tipogastogrupo para una de las cajas involucradas.",
          confirmButtonColor: "#0d9488",
        });
        return;
      }

      // El backend crea el egreso en la aperturada y el ingreso en la caja
      // destino, y ajusta ambos saldos, todo en una única transacción: no
      // puede quedar una pata sin la otra.
      await createPaseCaja({
        CajaOrigenId: cajaIdEgreso,
        CajaDestinoId: cajaSeleccionadaEgreso,
        RegistroDiarioCajaFecha: fechaEgreso,
        RegistroDiarioCajaDetalle: detalleEgreso,
        RegistroDiarioCajaMonto: Number(montoEgreso),
      });

      Swal.fire(
        "Egreso registrado",
        "El egreso fue registrado correctamente",
        "success"
      );

      // Limpiar formulario
      setDetalleEgreso("");
      setMontoEgreso("");
      setCajaSeleccionadaEgreso("");

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaEgreso(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        "No se pudo registrar el egreso";
      Swal.fire("Error", errorMsg, "error");
    } finally {
      setIsSubmittingEgreso(false);
    }
  };

  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingIngreso) return;
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar ingresos.",
        confirmButtonColor: "#0d9488",
      });
      return;
    }

    setIsSubmittingIngreso(true);
    try {
      if (!cajaSeleccionadaIngreso) {
        Swal.fire({
          icon: "warning",
          title: "Caja no seleccionada",
          text: "Debes seleccionar una caja origen.",
          confirmButtonColor: "#0d9488",
        });
        return;
      }

      // Resolver grupos PASE dinámicamente según las cajas involucradas:
      //  - aperturada (recibe el ingreso) -> grupo "PASE <origen>" en TipoGasto=2
      //  - origen (egresa la plata)       -> grupo "PASE <aperturada>" en TipoGasto=1
      const cajaOrigen = cajasTipo1.find(
        (c) => Number(c.CajaId) === Number(cajaSeleccionadaIngreso)
      );
      const grupoIngresoAperturada = getPaseGrupo(cajaOrigen, 2);
      const grupoEgresoOrigen = getPaseGrupo(cajaAperturada, 1);

      if (!grupoIngresoAperturada || !grupoEgresoOrigen) {
        Swal.fire({
          icon: "warning",
          title: "Grupo PASE no configurado",
          text: "Falta el grupo 'PASE <CajaDescripcion>' en tipogastogrupo para una de las cajas involucradas.",
          confirmButtonColor: "#0d9488",
        });
        return;
      }

      // El backend crea el egreso en la caja origen y el ingreso en la
      // aperturada, y ajusta ambos saldos, todo en una única transacción: no
      // puede quedar una pata sin la otra.
      await createPaseCaja({
        CajaOrigenId: cajaSeleccionadaIngreso,
        CajaDestinoId: cajaIdIngreso,
        RegistroDiarioCajaFecha: fechaIngreso,
        RegistroDiarioCajaDetalle: detalleIngreso,
        RegistroDiarioCajaMonto: Number(montoIngreso),
      });

      Swal.fire(
        "Ingreso registrado",
        "El ingreso fue registrado correctamente",
        "success"
      );

      // Limpiar formulario
      setDetalleIngreso("");
      setMontoIngreso("");
      setCajaSeleccionadaIngreso("");

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaIngreso(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        (err as { message?: string })?.message ||
        "No se pudo registrar el ingreso";
      Swal.fire("Error", errorMsg, "error");
    } finally {
      setIsSubmittingIngreso(false);
    }
  };

  const handleCancelEgreso = () => {
    setDetalleEgreso("");
    setMontoEgreso("");
    setCajaSeleccionadaEgreso("");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaEgreso(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const handleCancelIngreso = () => {
    setDetalleIngreso("");
    setMontoIngreso("");
    setCajaSeleccionadaIngreso("");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaIngreso(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const renderForm = (
    titulo: string,
    fecha: string,
    setFecha: (value: string) => void,
    tipoGastoId: number,
    grupoDescripcion: string,
    detalle: string,
    setDetalle: (value: string) => void,
    monto: number | "",
    setMonto: (value: number | "") => void,
    cajaSeleccionada: string | number,
    setCajaSeleccionada: (value: string | number) => void,
    cajaAperturadaId: string | number | "",
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void,
    autoFocusCaja: boolean = false,
    isSubmitting: boolean = false
  ) => {
    // Sólo cajas con grupo PASE configurado (en ambos sentidos), excluyendo la
    // caja aperturada del usuario.
    const cajasDisponibles = cajasConPase.filter(
      (caja) => Number(caja.CajaId) !== Number(cajaAperturadaId)
    );

    return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
        {titulo.toUpperCase()}
      </h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <CampoFecha
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Gasto - Solo lectura ya que está fijo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gasto
            </label>
            <input
              type="text"
              value={
                tiposGasto.find((tg) => tg.TipoGastoId === tipoGastoId)
                  ?.TipoGastoDescripcion || ""
              }
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
          </div>

          {/* Grupo - Solo lectura ya que está fijo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grupo
            </label>
            <input
              type="text"
              value={grupoDescripcion || ""}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
          </div>

          {/* Caja Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caja Destino
            </label>
            <select
              value={cajaSeleccionada}
              onChange={(e) => setCajaSeleccionada(Number(e.target.value))}
              required
              autoFocus={autoFocusCaja}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seleccione una caja...</option>
              {cajasDisponibles.map((caja) => (
                <option key={caja.CajaId} value={caja.CajaId}>
                  {caja.CajaDescripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <input
              type="text"
              value={monto !== "" ? formatMiles(monto) : ""}
              onChange={(e) => {
                const raw = e.target.value
                  .replace(/\./g, "")
                  .replace(/,/g, ".");
                const num = Number(raw);
                setMonto(isNaN(num) ? "" : num);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              inputMode="numeric"
            />
          </div>

          {/* Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={user?.id || ""}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
          </div>
        </div>

        {/* Detalle - Textarea largo */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Detalle
          </label>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ingrese el detalle del registro..."
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "PROCESANDO..." : "CONFIRMAR"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            CANCELAR
          </button>
        </div>
      </form>
    </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Formularios de Egreso e Ingreso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda - Egreso */}
        <div>
          {renderForm(
            "Egreso",
            fechaEgreso,
            setFechaEgreso,
            tipoGastoIdEgreso,
            grupoEgresoForm?.TipoGastoGrupoDescripcion || "",
            detalleEgreso,
            setDetalleEgreso,
            montoEgreso,
            setMontoEgreso,
            cajaSeleccionadaEgreso,
            setCajaSeleccionadaEgreso,
            cajaIdEgreso,
            handleSubmitEgreso,
            handleCancelEgreso,
            true, // autoFocus en Caja Destino al montar el tab
            isSubmittingEgreso
          )}
        </div>

        {/* Columna Derecha - Ingreso */}
        <div>
          {renderForm(
            "Ingreso",
            fechaIngreso,
            setFechaIngreso,
            tipoGastoIdIngreso,
            grupoIngresoForm?.TipoGastoGrupoDescripcion || "",
            detalleIngreso,
            setDetalleIngreso,
            montoIngreso,
            setMontoIngreso,
            cajaSeleccionadaIngreso,
            setCajaSeleccionadaIngreso,
            cajaIdIngreso,
            handleSubmitIngreso,
            handleCancelIngreso,
            false, // autoFocus
            isSubmittingIngreso
          )}
        </div>
      </div>
    </div>
  );
}
