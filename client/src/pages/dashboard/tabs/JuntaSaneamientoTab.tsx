import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import {
  createJSICobro,
  type JSICobro,
} from "../../../services/jsicobro.service";
import { getCajaById, updateCajaMonto } from "../../../services/cajas.service";
import {
  getCajaGastosByCajaId,
  getCajaGastosByTipoGastoAndGrupo,
} from "../../../services/cajagasto.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import {
  getAllClientesSinPaginacion,
  createCliente,
} from "../../../services/clientes.service";
import ClienteModal from "../../../components/common/ClienteModal";
import Swal from "sweetalert2";
import { formatMiles } from "../../../utils/utils";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  [key: string]: unknown;
}

interface Cliente {
  ClienteId: number;
  ClienteNombre: string;
  ClienteApellido: string;
  ClienteRUC: string;
  ClienteDireccion: string;
  ClienteTelefono: string;
  ClienteTipo: string;
  ClienteCodJSI?: string;
  UsuarioId: string;
  [key: string]: unknown;
}

interface CajaGasto {
  CajaGastoId: string | number;
  CajaId: string | number;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  [key: string]: unknown;
}

const CAJA_JSI_ID = 23;

export default function JuntaSaneamientoTab() {
  const { user } = useAuth();
  const [cajaJSI, setCajaJSI] = useState<Caja | null>(null);
  const [cajaAperturadaId, setCajaAperturadaId] = useState<number | null>(null);
  const [tipoGastoId, setTipoGastoId] = useState<number | null>(null);
  const [tipoGastoGrupoId, setTipoGastoGrupoId] = useState<number | null>(null);

  // Estados para formulario de cobro JSI
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<Cliente | null>(null);
  const [jsicobroFecha, setJSICobroFecha] = useState("");
  const [jsicobroCod, setJSICobroCod] = useState("");
  const [codigoJSI, setCodigoJSI] = useState("");
  const [monto, setMonto] = useState<number | "">("");
  const [mostrarMensajeBusqueda, setMostrarMensajeBusqueda] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener la caja JSI
        const caja = await getCajaById(CAJA_JSI_ID);
        setCajaJSI(caja);

        // Obtener caja aperturada del usuario
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          setCajaAperturadaId(Number(estado.cajaId));
        } else {
          Swal.fire({
            icon: "warning",
            title: "Caja no aperturada",
            text: "Debes aperturar una caja antes de realizar cobros de JSI.",
            confirmButtonColor: "#2563eb",
          });
        }

        // Obtener los gastos de la caja JSI para obtener TipoGastoId y TipoGastoGrupoId
        // El cobro es un ingreso, así que TipoGastoId debe ser 2
        const gastos = await getCajaGastosByCajaId(CAJA_JSI_ID);
        if (gastos && gastos.length > 0) {
          // Buscar un gasto con TipoGastoId = 2 (ingreso)
          const gastoIngreso = gastos.find(
            (g: CajaGasto) => Number(g.TipoGastoId) === 2
          );
          if (gastoIngreso) {
            setTipoGastoId(2); // Ingreso
            setTipoGastoGrupoId(Number(gastoIngreso.TipoGastoGrupoId));
          } else {
            // Si no hay gasto de ingreso, usar el primero pero forzar TipoGastoId = 2
            const primerGasto = gastos[0] as CajaGasto;
            setTipoGastoId(2); // Forzar ingreso
            setTipoGastoGrupoId(Number(primerGasto.TipoGastoGrupoId));
          }
        } else {
          Swal.fire({
            icon: "warning",
            title: "Configuración incompleta",
            text: "La caja J.S.I. no tiene TipoGastoId y TipoGastoGrupoId asignados.",
            confirmButtonColor: "#2563eb",
          });
        }

        // Obtener clientes
        const clientesData = await getAllClientesSinPaginacion();
        setClientes(clientesData.data || []);

        // Inicializar fecha actual
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        setJSICobroFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } catch (error) {
        console.error("Error al cargar datos:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "No se pudo cargar la información necesaria.",
        });
      }
    };
    fetchData();
  }, [user]);

  // Sincronizar código JSI cuando cambia el cliente seleccionado
  useEffect(() => {
    if (clienteSeleccionado?.ClienteCodJSI) {
      setCodigoJSI(clienteSeleccionado.ClienteCodJSI);
    } else if (!clienteSeleccionado) {
      // Si no hay cliente seleccionado y el código JSI no coincide con ningún cliente, mantenerlo
      // (no limpiar automáticamente para permitir búsqueda)
    }
  }, [clienteSeleccionado]);

  const resetForm = () => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setJSICobroFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    setJSICobroCod("");
    setCodigoJSI("");
    setMonto("");
    setClienteSeleccionado(null);
    setMostrarMensajeBusqueda(false);
  };

  const handleCodigoJSIChange = (value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/[^0-9]/g, "");
    setCodigoJSI(numericValue);
    // Ocultar mensajes mientras se escribe
    setMostrarMensajeBusqueda(false);
  };

  const handleCodigoJSIBlur = () => {
    // Buscar cliente por código JSI cuando pierde el foco
    if (codigoJSI.trim()) {
      const clienteEncontrado = clientes.find(
        (c) =>
          c.ClienteCodJSI && String(c.ClienteCodJSI).trim() === codigoJSI.trim()
      );
      if (clienteEncontrado) {
        setClienteSeleccionado(clienteEncontrado);
      } else {
        // Si no se encuentra, limpiar la selección pero mantener el código
        setClienteSeleccionado(null);
      }
      // Mostrar mensajes después de buscar
      setMostrarMensajeBusqueda(true);
    } else {
      // Si el código está vacío, limpiar la selección
      setClienteSeleccionado(null);
      setMostrarMensajeBusqueda(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturadaId || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no disponible",
        text: "Debes tener una caja aperturada para realizar cobros de JSI.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!tipoGastoId || !tipoGastoGrupoId) {
      Swal.fire({
        icon: "warning",
        title: "Configuración incompleta",
        text: "La caja J.S.I. no tiene TipoGastoId y TipoGastoGrupoId asignados.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!monto || Number(monto) <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Datos incompletos",
        text: "Debes ingresar un monto válido.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // El cobro es un ingreso, TipoGastoId debe ser 2
      const tipoGastoIdIngreso = 2;

      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoIdIngreso,
        tipoGastoGrupoId
      );

      // Crear el cobro de JSI usando la caja aperturada del usuario
      const jsicobroData: JSICobro = {
        JSICobroFecha: jsicobroFecha,
        JSICobroCod: jsicobroCod,
        CajaId: cajaAperturadaId, // Usar la caja aperturada del usuario
        ClienteId: clienteSeleccionado
          ? Number(clienteSeleccionado.ClienteId)
          : undefined,
        JSICobroMonto: monto ? Number(monto) : 0,
        JSICobroUsuarioId: user?.id ? Number(user.id) : undefined,
      };

      // Crear el cobro de JSI primero para obtener su ID
      const jsicobroResponse = await createJSICobro(jsicobroData);

      // Obtener el ID del cobro creado
      const jsicobroId =
        jsicobroResponse.data?.JSICobroId || jsicobroResponse.JSICobroId;

      // Crear registro diario de caja con ClienteId en el detalle
      // Usar la caja aperturada del usuario
      const detalleRegistro = clienteSeleccionado
        ? `ClienteId:${clienteSeleccionado.ClienteId} | JSICobroId:${jsicobroId}`
        : `JSICobroId:${jsicobroId}`;

      await createRegistroDiarioCaja({
        CajaId: cajaAperturadaId, // Usar la caja aperturada del usuario
        RegistroDiarioCajaFecha: jsicobroFecha,
        TipoGastoId: tipoGastoIdIngreso, // Ingreso
        TipoGastoGrupoId: tipoGastoGrupoId,
        RegistroDiarioCajaDetalle: detalleRegistro,
        RegistroDiarioCajaMonto: monto ? Number(monto) : 0,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas que tienen el gasto asignado
      const cajasIdsConGasto = new Set<number>();
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      });

      const montoNumero = Number(monto) || 0;

      // Actualizar la caja aperturada: SUMAR el monto
      const cajaAperturadaActual = await getCajaById(cajaAperturadaId);
      const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
      await updateCajaMonto(
        cajaAperturadaId,
        cajaAperturadaMontoActual + montoNumero
      );

      // Actualizar las demás cajas que tienen el gasto asignado: RESTAR el monto
      // (excluyendo la caja aperturada si está en la lista)
      const cajasParaRestar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaAperturadaId
      );

      if (cajasParaRestar.length > 0) {
        const actualizaciones = cajasParaRestar.map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            // Restar el monto (es un gasto para estas cajas)
            await updateCajaMonto(
              cajaIdParaActualizar,
              cajaMontoActual - montoNumero
            );
          }
        );

        await Promise.all(actualizaciones);
      }

      Swal.fire(
        "Cobro de JSI registrado",
        "El cobro de JSI fue registrado correctamente",
        "success"
      );

      resetForm();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "No se pudo registrar el cobro de JSI";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
          COBROS DE JUNTA DE SANEAMIENTO ITAUGUÁ
        </h2>

        {cajaJSI && (
          <div className="mb-4 p-3 bg-primary-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-primary-800">
              <strong>Caja:</strong> {cajaJSI.CajaDescripcion} (ID:{" "}
              {cajaJSI.CajaId})
            </p>
            <p className="text-sm text-primary-800">
              <strong>Monto actual:</strong>{" "}
              {formatMiles(Number(cajaJSI.CajaMonto))} Gs.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                value={jsicobroFecha}
                onChange={(e) => setJSICobroFecha(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Código */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código
              </label>
              <input
                type="text"
                value={jsicobroCod}
                onChange={(e) => setJSICobroCod(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto <span className="text-destructive">*</span>
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

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowClienteModal(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-left bg-white hover:bg-gray-50 transition"
              >
                {clienteSeleccionado
                  ? `${clienteSeleccionado.ClienteNombre} ${
                      clienteSeleccionado.ClienteApellido || ""
                    }`
                  : "Seleccione un cliente..."}
              </button>
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código JSI
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={codigoJSI}
                  onChange={(e) => handleCodigoJSIChange(e.target.value)}
                  onBlur={handleCodigoJSIBlur}
                  placeholder="Escriba el código JSI numérico y presione Tab para buscar cliente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {mostrarMensajeBusqueda && clienteSeleccionado && codigoJSI && (
                  <p className="mt-1 text-xs text-success-600">
                    Cliente encontrado: {clienteSeleccionado.ClienteNombre}{" "}
                    {clienteSeleccionado.ClienteApellido || ""}
                  </p>
                )}
                {mostrarMensajeBusqueda &&
                  !clienteSeleccionado &&
                  codigoJSI && (
                    <p className="mt-1 text-xs text-danger-600">
                      No se encontró un cliente con este código JSI
                    </p>
                  )}
              </div>
            </div>
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
        <ClienteModal
          show={showClienteModal}
          onClose={() => setShowClienteModal(false)}
          clientes={clientes as unknown as Cliente[]}
          onSelect={(cliente) => {
            const clienteSeleccionado = cliente as unknown as Cliente;
            setClienteSeleccionado(clienteSeleccionado);
            // Actualizar el código JSI cuando se selecciona un cliente
            if (clienteSeleccionado.ClienteCodJSI) {
              setCodigoJSI(clienteSeleccionado.ClienteCodJSI);
            }
            setShowClienteModal(false);
          }}
          onCreateCliente={async (clienteData) => {
            try {
              const nuevoCliente = await createCliente(
                clienteData as unknown as Record<string, unknown>
              );
              const response = await getAllClientesSinPaginacion();
              setClientes(response.data || []);
              if (nuevoCliente.data) {
                const clienteCreado = nuevoCliente.data as unknown as Cliente;
                setClienteSeleccionado(clienteCreado);
                // Actualizar el código JSI si el cliente creado tiene uno
                if (clienteCreado.ClienteCodJSI) {
                  setCodigoJSI(clienteCreado.ClienteCodJSI);
                }
                setShowClienteModal(false);
                Swal.fire({
                  icon: "success",
                  title: "Cliente creado exitosamente",
                  text: "El cliente ha sido creado y seleccionado",
                  timer: 2000,
                  showConfirmButton: false,
                });
              } else {
                Swal.fire({
                  icon: "error",
                  title: "Error al crear cliente",
                  text: "No se recibió la información del cliente creado",
                });
              }
            } catch (error) {
              console.error("Error al crear cliente:", error);
              Swal.fire({
                icon: "error",
                title: "Error al crear cliente",
                text: "Hubo un problema al crear el cliente",
              });
            }
          }}
          currentUserId={user?.id}
        />
      </div>
    </div>
  );
}
