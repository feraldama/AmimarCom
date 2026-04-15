import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById, getCajas } from "../../../services/cajas.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import { getTiposGasto } from "../../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../../services/tipogastogrupo.service";
import { updateCajaMonto } from "../../../services/cajas.service";
import { getCajaGastosByTipoGastoAndGrupo } from "../../../services/cajagasto.service";
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

  // Formulario Egreso (tipogastoid = 1, tipogastogrupoid = 21)
  const [cajaIdEgreso, setCajaIdEgreso] = useState<string | number>("");
  const [fechaEgreso, setFechaEgreso] = useState("");
  const tipoGastoIdEgreso = 1; // Fijo en 1 (Egreso)
  const tipoGastoGrupoIdEgreso = 21; // Fijo en 21
  const [detalleEgreso, setDetalleEgreso] = useState("");
  const [montoEgreso, setMontoEgreso] = useState<number | "">("");
  const [cajaSeleccionadaEgreso, setCajaSeleccionadaEgreso] = useState<
    string | number
  >("");

  // Formulario Ingreso (tipogastoid = 2, tipogastogrupoid = 26)
  const [cajaIdIngreso, setCajaIdIngreso] = useState<string | number>("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const tipoGastoIdIngreso = 2; // Fijo en 2 (Ingreso)
  const tipoGastoGrupoIdIngreso = 26; // Fijo en 26
  const [detalleIngreso, setDetalleIngreso] = useState("");
  const [montoIngreso, setMontoIngreso] = useState<number | "">("");
  const [cajaSeleccionadaIngreso, setCajaSeleccionadaIngreso] = useState<
    string | number
  >("");

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

  // Obtener el grupo de egreso (ID 21)
  const grupoEgreso = tiposGastoGrupo.find(
    (g) => g.TipoGastoGrupoId === tipoGastoGrupoIdEgreso
  );

  // Obtener el grupo de ingreso (ID 26)
  const grupoIngreso = tiposGastoGrupo.find(
    (g) => g.TipoGastoGrupoId === tipoGastoGrupoIdIngreso
  );

  const handleSubmitEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar egresos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoIdEgreso,
        tipoGastoGrupoIdEgreso
      );

      if (!cajaSeleccionadaEgreso) {
        Swal.fire({
          icon: "warning",
          title: "Caja no seleccionada",
          text: "Debes seleccionar una caja destino.",
          confirmButtonColor: "#2563eb",
        });
        return;
      }

      const montoNumero = Number(montoEgreso);

      // Crear el registro de egreso de la caja aperturada
      await createRegistroDiarioCaja({
        CajaId: cajaIdEgreso,
        RegistroDiarioCajaFecha: fechaEgreso,
        TipoGastoId: tipoGastoIdEgreso,
        TipoGastoGrupoId: tipoGastoGrupoIdEgreso,
        RegistroDiarioCajaDetalle: detalleEgreso,
        RegistroDiarioCajaMonto: montoEgreso,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Crear el registro de ingreso para la caja seleccionada
      await createRegistroDiarioCaja({
        CajaId: cajaSeleccionadaEgreso,
        RegistroDiarioCajaFecha: fechaEgreso,
        TipoGastoId: tipoGastoIdIngreso, // 2 (Ingreso)
        TipoGastoGrupoId: tipoGastoGrupoIdIngreso, // 26
        RegistroDiarioCajaDetalle: detalleEgreso,
        RegistroDiarioCajaMonto: montoEgreso,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas a actualizar
      const cajasIdsParaActualizar = new Set<number>();

      // Agregar todas las cajas que tengan el gasto asignado
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
      });

      // Agregar también la caja aperturada
      cajasIdsParaActualizar.add(Number(cajaIdEgreso));

      // Actualizar el monto de todas las cajas con el gasto asignado (restar)
      if (cajasIdsParaActualizar.size > 0) {
        const actualizaciones = Array.from(cajasIdsParaActualizar).map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);

            // tipoGastoIdEgreso siempre es 1 (Egreso): restar el monto
            await updateCajaMonto(
              cajaIdParaActualizar,
              cajaMontoActual - montoNumero
            );
          }
        );

        await Promise.all(actualizaciones);
      }

      // Actualizar el monto de la caja seleccionada (sumar)
      const cajaSeleccionadaActual = await getCajaById(cajaSeleccionadaEgreso);
      const cajaSeleccionadaMontoActual = Number(
        cajaSeleccionadaActual.CajaMonto
      );
      await updateCajaMonto(
        Number(cajaSeleccionadaEgreso),
        cajaSeleccionadaMontoActual + montoNumero
      );

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
        err instanceof Error ? err.message : "No se pudo registrar el egreso";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar ingresos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoIdIngreso,
        tipoGastoGrupoIdIngreso
      );

      if (!cajaSeleccionadaIngreso) {
        Swal.fire({
          icon: "warning",
          title: "Caja no seleccionada",
          text: "Debes seleccionar una caja destino.",
          confirmButtonColor: "#2563eb",
        });
        return;
      }

      const montoNumero = Number(montoIngreso);

      // Crear el registro de ingreso de la caja aperturada
      await createRegistroDiarioCaja({
        CajaId: cajaIdIngreso,
        RegistroDiarioCajaFecha: fechaIngreso,
        TipoGastoId: tipoGastoIdIngreso,
        TipoGastoGrupoId: tipoGastoGrupoIdIngreso,
        RegistroDiarioCajaDetalle: detalleIngreso,
        RegistroDiarioCajaMonto: montoIngreso,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Crear el registro de egreso para la caja seleccionada
      await createRegistroDiarioCaja({
        CajaId: cajaSeleccionadaIngreso,
        RegistroDiarioCajaFecha: fechaIngreso,
        TipoGastoId: tipoGastoIdEgreso, // 1 (Egreso)
        TipoGastoGrupoId: tipoGastoGrupoIdEgreso, // 21
        RegistroDiarioCajaDetalle: detalleIngreso,
        RegistroDiarioCajaMonto: montoIngreso,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas a actualizar
      const cajasIdsParaActualizar = new Set<number>();

      // Agregar todas las cajas que tengan el gasto asignado
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
      });

      // Agregar también la caja aperturada
      cajasIdsParaActualizar.add(Number(cajaIdIngreso));

      // Actualizar el monto de todas las cajas con el gasto asignado (sumar)
      if (cajasIdsParaActualizar.size > 0) {
        const actualizaciones = Array.from(cajasIdsParaActualizar).map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);

            // tipoGastoIdIngreso siempre es 2 (Ingreso): sumar el monto
            await updateCajaMonto(
              cajaIdParaActualizar,
              cajaMontoActual + montoNumero
            );
          }
        );

        await Promise.all(actualizaciones);
      }

      // Actualizar el monto de la caja seleccionada (restar)
      const cajaSeleccionadaActual = await getCajaById(cajaSeleccionadaIngreso);
      const cajaSeleccionadaMontoActual = Number(
        cajaSeleccionadaActual.CajaMonto
      );
      await updateCajaMonto(
        Number(cajaSeleccionadaIngreso),
        cajaSeleccionadaMontoActual - montoNumero
      );

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
        err instanceof Error ? err.message : "No se pudo registrar el ingreso";
      Swal.fire("Error", errorMsg, "error");
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
    onCancel: () => void
  ) => {
    // Filtrar cajas excluyendo la caja aperturada
    const cajasDisponibles = cajasTipo1.filter(
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
            <input
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
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            CANCELAR
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition font-medium"
          >
            CONFIRMAR
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
            grupoEgreso?.TipoGastoGrupoDescripcion || "",
            detalleEgreso,
            setDetalleEgreso,
            montoEgreso,
            setMontoEgreso,
            cajaSeleccionadaEgreso,
            setCajaSeleccionadaEgreso,
            cajaIdEgreso,
            handleSubmitEgreso,
            handleCancelEgreso
          )}
        </div>

        {/* Columna Derecha - Ingreso */}
        <div>
          {renderForm(
            "Ingreso",
            fechaIngreso,
            setFechaIngreso,
            tipoGastoIdIngreso,
            grupoIngreso?.TipoGastoGrupoDescripcion || "",
            detalleIngreso,
            setDetalleIngreso,
            montoIngreso,
            setMontoIngreso,
            cajaSeleccionadaIngreso,
            setCajaSeleccionadaIngreso,
            cajaIdIngreso,
            handleSubmitIngreso,
            handleCancelIngreso
          )}
        </div>
      </div>
    </div>
  );
}
