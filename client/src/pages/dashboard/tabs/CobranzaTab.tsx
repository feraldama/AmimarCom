import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById, updateCajaMonto, getCajas } from "../../../services/cajas.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import { getTiposGasto } from "../../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../../services/tipogastogrupo.service";
import { getCajaGastosByTipoGastoAndGrupo, getCajaGastosByCajaId } from "../../../services/cajagasto.service";
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

export default function CobranzaTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [tiposGastoDisponibles, setTiposGastoDisponibles] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupoDisponibles, setTiposGastoGrupoDisponibles] = useState<TipoGastoGrupo[]>([]);
  const [gruposValidos, setGruposValidos] = useState<Set<string>>(new Set()); // Set de "TipoGastoId-TipoGastoGrupoId" válidos

  // Formulario
  const [cajaId, setCajaId] = useState<string | number>("");
  const [fecha, setFecha] = useState("");
  const [tipoGastoId, setTipoGastoId] = useState<number | "">("");
  const [tipoGastoGrupoId, setTipoGastoGrupoId] = useState<number | "">("");
  const [cambioDolar, setCambioDolar] = useState<number | "">("");
  const [detalle, setDetalle] = useState("");
  const [mtcn, setMtcn] = useState<number | "">("");
  const [cargoEnvio, setCargoEnvio] = useState<number | "">("");
  const [monto, setMonto] = useState<number | "">("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener caja aperturada
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
          setCajaId(estado.cajaId);
        } else {
          setCajaAperturada(null);
        }

        // Obtener todos los tipos de gasto y grupos
        const tiposGastoData = await getTiposGasto();
        const tiposGastoGrupoData = await getTiposGastoGrupo();

        // Obtener todas las cajas con CajaTipoId = 9
        const cajasData = await getCajas(1, 1000);
        const cajasTipo9 = cajasData.data.filter(
          (caja: Caja) => caja.CajaTipoId === 9
        );

        // Obtener todos los gastos de estas cajas y extraer TipoGastoId y TipoGastoGrupoId únicos
        // Para tipos de gasto: incluir todos los que tienen gastos en estas cajas
        // Para grupos: solo incluir donde TipoGastoGrupoDescripcion está contenido en CajaDescripcion
        const gastosUnicos = new Set<string>();
        const gruposValidosSet = new Set<string>(); // Set de "TipoGastoId-TipoGastoGrupoId" válidos
        
        for (const caja of cajasTipo9) {
          try {
            const gastos = await getCajaGastosByCajaId(caja.CajaId);
            if (Array.isArray(gastos)) {
              gastos.forEach((gasto: { TipoGastoId: number; TipoGastoGrupoId: number }) => {
                const gastoKey = `${gasto.TipoGastoId}-${gasto.TipoGastoGrupoId}`;
                
                // Agregar todos los tipos de gasto (sin filtrar)
                gastosUnicos.add(gastoKey);
                
                // Buscar el grupo completo para obtener su descripción
                const grupo = tiposGastoGrupoData.find(
                  (g: TipoGastoGrupo) => g.TipoGastoId === gasto.TipoGastoId && g.TipoGastoGrupoId === gasto.TipoGastoGrupoId
                );
                
                // Solo agregar a grupos válidos si TipoGastoGrupoDescripcion está contenido en CajaDescripcion
                // Comparación case-insensitive
                if (grupo) {
                  const cajaDescUpper = caja.CajaDescripcion.trim().toUpperCase();
                  const grupoDescUpper = grupo.TipoGastoGrupoDescripcion.trim().toUpperCase();
                  if (cajaDescUpper.includes(grupoDescUpper)) {
                    gruposValidosSet.add(gastoKey);
                  }
                }
              });
            }
          } catch (error) {
            console.error(`Error al obtener gastos de caja ${caja.CajaId}:`, error);
          }
        }

        // Filtrar tipos de gasto disponibles (todos los que tienen gastos en estas cajas)
        const tiposGastoIds = new Set<number>();
        const gruposMap = new Map<string, TipoGastoGrupo>();

        gastosUnicos.forEach((key) => {
          const [tipoId, grupoId] = key.split("-").map(Number);
          tiposGastoIds.add(tipoId);
          const grupo = tiposGastoGrupoData.find(
            (g: TipoGastoGrupo) => g.TipoGastoId === tipoId && g.TipoGastoGrupoId === grupoId
          );
          if (grupo) {
            gruposMap.set(key, grupo);
          }
        });

        const tiposFiltrados = tiposGastoData.filter((tg: TipoGasto) =>
          tiposGastoIds.has(tg.TipoGastoId)
        );
        const gruposFiltrados = Array.from(gruposMap.values());

        setTiposGastoDisponibles(tiposFiltrados);
        setTiposGastoGrupoDisponibles(gruposFiltrados);
        setGruposValidos(gruposValidosSet);

        // Inicializar fecha actual
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        setFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  const gruposFiltrados = tiposGastoGrupoDisponibles
    .filter((g) => {
      // Filtrar por TipoGastoId seleccionado
      if (g.TipoGastoId !== tipoGastoId) return false;
      // Filtrar solo los grupos válidos (donde TipoGastoGrupoDescripcion está contenido en CajaDescripcion)
      const grupoKey = `${g.TipoGastoId}-${g.TipoGastoGrupoId}`;
      return gruposValidos.has(grupoKey);
    })
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar cobranzas.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!tipoGastoId || !tipoGastoGrupoId) {
      Swal.fire({
        icon: "warning",
        title: "Datos incompletos",
        text: "Debes seleccionar un tipo de gasto y grupo.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoId,
        tipoGastoGrupoId
      );

      // Crear el registro diario de caja
      await createRegistroDiarioCaja({
        CajaId: cajaId,
        RegistroDiarioCajaFecha: fecha,
        TipoGastoId: tipoGastoId,
        TipoGastoGrupoId: tipoGastoGrupoId,
        RegistroDiarioCajaDetalle: detalle,
        RegistroDiarioCajaMonto: monto ? Number(monto) : 0,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: cambioDolar || 0,
        RegistroDiarioCajaMTCN: mtcn || 0,
        RegistroDiarioCajaCargoEnvio: cargoEnvio || 0,
      });

      // Obtener IDs únicos de todas las cajas que tienen el gasto asignado
      const cajasIdsConGasto = new Set<number>();
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      });

      const montoNumero = Number(monto) || 0;
      const cajaIdNumero = Number(cajaId);

      // Determinar si es EGRESO (TipoGastoId = 1) o INGRESO (TipoGastoId = 2)
      const esEgreso = tipoGastoId === 1;
      const esIngreso = tipoGastoId === 2;

      // Actualizar la caja aperturada
      // Si es EGRESO: RESTAR el monto
      // Si es INGRESO: SUMAR el monto
      const cajaAperturadaActual = await getCajaById(cajaIdNumero);
      const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
      if (esEgreso) {
        await updateCajaMonto(
          cajaIdNumero,
          cajaAperturadaMontoActual - montoNumero
        );
      } else if (esIngreso) {
        await updateCajaMonto(
          cajaIdNumero,
          cajaAperturadaMontoActual + montoNumero
        );
      }

      // Actualizar las demás cajas que tienen el gasto asignado
      // (excluyendo la caja aperturada si está en la lista)
      const cajasParaActualizar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdNumero
      );

      if (cajasParaActualizar.length > 0) {
        const actualizaciones = cajasParaActualizar.map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            
            // Si es EGRESO: SUMAR el monto a las demás cajas
            // Si es INGRESO: RESTAR el monto a las demás cajas
            if (esEgreso) {
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoNumero
              );
            } else if (esIngreso) {
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual - montoNumero
              );
            }
          }
        );

        await Promise.all(actualizaciones);
      }

      Swal.fire(
        "Cobranza registrada",
        "La cobranza fue registrada correctamente",
        "success"
      );

      // Limpiar formulario
      setTipoGastoId("");
      setTipoGastoGrupoId("");
      setCambioDolar("");
      setDetalle("");
      setMtcn("");
      setCargoEnvio("");
      setMonto("");

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar la cobranza";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleCancel = () => {
    setTipoGastoId("");
    setTipoGastoGrupoId("");
    setCambioDolar("");
    setDetalle("");
    setMtcn("");
    setCargoEnvio("");
    setMonto("");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
          COBRANZA
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Gasto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gasto
              </label>
              <select
                value={tipoGastoId}
                onChange={(e) => {
                  setTipoGastoId(Number(e.target.value));
                  setTipoGastoGrupoId(""); // Reset grupo cuando cambia gasto
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Seleccione...</option>
                {tiposGastoDisponibles.map((tg) => (
                  <option key={tg.TipoGastoId} value={tg.TipoGastoId}>
                    {tg.TipoGastoDescripcion}
                  </option>
                ))}
              </select>
            </div>

            {/* Grupo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grupo
              </label>
              <select
                value={tipoGastoGrupoId}
                onChange={(e) => setTipoGastoGrupoId(Number(e.target.value))}
                required
                disabled={!tipoGastoId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Seleccione...</option>
                {gruposFiltrados.map((gg) => (
                  <option key={gg.TipoGastoGrupoId} value={gg.TipoGastoGrupoId}>
                    {gg.TipoGastoGrupoDescripcion}
                  </option>
                ))}
              </select>
            </div>

            {/* Cambio Dolar - OCULTO */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cambio Dolar
              </label>
              <input
                type="number"
                step="0.01"
                value={cambioDolar}
                onChange={(e) =>
                  setCambioDolar(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div> */}

            {/* MTCN - OCULTO */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MTCN
              </label>
              <input
                type="number"
                value={mtcn}
                onChange={(e) =>
                  setMtcn(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div> */}

            {/* Cargo Envio - OCULTO */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo Envio
              </label>
              <input
                type="text"
                value={cargoEnvio !== "" ? formatMiles(cargoEnvio) : ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/,/g, ".");
                  const num = Number(raw);
                  setCargoEnvio(isNaN(num) ? "" : num);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                inputMode="numeric"
              />
            </div> */}

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
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ingrese el detalle del registro..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
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
    </div>
  );
}
