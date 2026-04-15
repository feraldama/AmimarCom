import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import {
  createPagoTrans,
  type PagoTrans,
} from "../../../services/pagotrans.service";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById, updateCajaMonto } from "../../../services/cajas.service";
import {
  getTransportes,
  getTransporteById,
} from "../../../services/transporte.service";
import { getCajaGastosByTipoGastoAndGrupo } from "../../../services/cajagasto.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
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

interface Transporte {
  TransporteId: number;
  TransporteNombre: string;
}

interface Cliente {
  ClienteId: number;
  ClienteNombre: string;
  ClienteApellido: string;
  ClienteRUC: string;
  ClienteDireccion: string;
  ClienteTelefono: string;
  ClienteTipo: string;
  UsuarioId: string;
  [key: string]: unknown;
}

export default function EmpresasTransporteTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);

  // Estados para formulario de pago de transporte
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<Cliente | null>(null);
  const [pagoTransFecha, setPagoTransFecha] = useState("");
  const [transporteIdPago, setTransporteIdPago] = useState<number | "">("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [fechaEmbarque, setFechaEmbarque] = useState("");
  const [hora, setHora] = useState("");
  const [asiento, setAsiento] = useState("");
  const [monto, setMonto] = useState<number | "">("");
  const [cajaId, setCajaId] = useState<string | number>("");
  const [numeroBoleto, setNumeroBoleto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [clienteRUC, setClienteRUC] = useState("");

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

        // Obtener datos para pagos de transporte
        const transportesData = await getTransportes(1, 1000);
        const transportesOrdenados = (transportesData.data || []).sort(
          (a: Transporte, b: Transporte) =>
            a.TransporteNombre.localeCompare(b.TransporteNombre)
        );
        setTransportes(transportesOrdenados);
        const clientesData = await getAllClientesSinPaginacion();
        setClientes(clientesData.data || []);

        // Inicializar fecha actual
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        setPagoTransFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
        // Inicializar fecha de embarque con la fecha de hoy
        setFechaEmbarque(`${yyyy}-${mm}-${dd}`);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  const resetForm = () => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setPagoTransFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    setTransporteIdPago("");
    setOrigen("");
    setDestino("");
    // Resetear fecha de embarque con la fecha de hoy
    setFechaEmbarque(`${yyyy}-${mm}-${dd}`);
    setHora("");
    setAsiento("");
    setMonto("");
    setCajaId("");
    setNumeroBoleto("");
    setTelefono("");
    setClienteSeleccionado(null);
    setClienteRUC("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar pagos de transporte.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!transporteIdPago) {
      Swal.fire({
        icon: "warning",
        title: "Datos incompletos",
        text: "Debes seleccionar un transporte.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener el transporte para saber su TipoGastoId y TipoGastoGrupoId
      const transporte = await getTransporteById(transporteIdPago);
      if (
        !transporte ||
        !transporte.TipoGastoId ||
        !transporte.TipoGastoGrupoId
      ) {
        Swal.fire({
          icon: "warning",
          title: "Error",
          text: "El transporte no tiene TipoGastoId y TipoGastoGrupoId asignados.",
          confirmButtonColor: "#2563eb",
        });
        return;
      }

      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        transporte.TipoGastoId,
        transporte.TipoGastoGrupoId
      );

      const pagoTransData: PagoTrans = {
        PagoTransFecha: pagoTransFecha,
        TransporteId: transporteIdPago ? Number(transporteIdPago) : undefined,
        PagoTransOrigen: origen.toUpperCase(),
        PagoTransDestino: destino.toUpperCase(),
        PagoTransFechaEmbarque: fechaEmbarque || undefined,
        PagoTransHora: hora,
        PagoTransAsiento: asiento,
        PagoTransMonto: monto ? Number(monto) : 0,
        CajaId: cajaId ? Number(cajaId) : undefined,
        PagoTransNumeroBoleto: numeroBoleto,
        PagoTransNombreApellido: clienteSeleccionado
          ? `${clienteSeleccionado.ClienteNombre} ${
              clienteSeleccionado.ClienteApellido || ""
            }`.trim()
          : "",
        PagoTransCI: "",
        PagoTransTelefono: telefono,
        ClienteId: clienteSeleccionado
          ? Number(clienteSeleccionado.ClienteId)
          : undefined,
        PagoTransUsuarioId: user?.id ? Number(user.id) : undefined,
        PagoTransClienteRUC: clienteRUC,
      };

      // Crear el pago de transporte primero para obtener su ID
      const pagoTransResponse = await createPagoTrans(pagoTransData);

      // Obtener el ID del pago creado
      const pagoTransId =
        pagoTransResponse.data?.PagoTransId || pagoTransResponse.PagoTransId;

      // Crear registro diario de caja con PagoTransId y TransporteId en el detalle
      const detalleRegistro = `Pago Transporte: ${
        transporte.TransporteNombre
      } - ${origen.toUpperCase()} a ${destino.toUpperCase()} | PagoTransId:${pagoTransId} TransporteId:${transporteIdPago}`;

      await createRegistroDiarioCaja({
        CajaId: cajaId,
        RegistroDiarioCajaFecha: pagoTransFecha,
        TipoGastoId: transporte.TipoGastoId,
        TipoGastoGrupoId: transporte.TipoGastoGrupoId,
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
      const cajaIdNumero = Number(cajaId);

      // Actualizar la caja aperturada: SUMAR el monto
      const cajaAperturadaActual = await getCajaById(cajaIdNumero);
      const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
      await updateCajaMonto(
        cajaIdNumero,
        cajaAperturadaMontoActual + montoNumero
      );

      // Actualizar las demás cajas que tienen el gasto asignado: RESTAR el monto
      // (excluyendo la caja aperturada si está en la lista)
      const cajasParaRestar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdNumero
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
        "Pago de transporte registrado",
        "El pago de transporte fue registrado correctamente",
        "success"
      );

      resetForm();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "No se pudo registrar el pago de transporte";
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
          PAGOS DE TRANSPORTE
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
                value={pagoTransFecha}
                onChange={(e) => setPagoTransFecha(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Transporte */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transporte
              </label>
              <select
                value={transporteIdPago}
                onChange={(e) => setTransporteIdPago(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Seleccione...</option>
                {transportes.map((t) => (
                  <option key={t.TransporteId} value={t.TransporteId}>
                    {t.TransporteNombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Origen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origen
              </label>
              <input
                type="text"
                value={origen}
                onChange={(e) => setOrigen(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Destino */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destino
              </label>
              <input
                type="text"
                value={destino}
                onChange={(e) => setDestino(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Fecha Embarque */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Embarque
              </label>
              <input
                type="date"
                value={fechaEmbarque}
                onChange={(e) => setFechaEmbarque(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Hora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Asiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asiento
              </label>
              <input
                type="text"
                value={asiento}
                onChange={(e) => setAsiento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
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

            {/* N° Boleto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° Boleto
              </label>
              <input
                type="text"
                value={numeroBoleto}
                onChange={(e) => setNumeroBoleto(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            </div>

            {/* Cliente RUC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente RUC
              </label>
              <input
                type="text"
                value={clienteRUC}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={telefono}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
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
            setClienteSeleccionado(cliente as unknown as Cliente);
            setClienteRUC(cliente.ClienteRUC || "");
            setTelefono(cliente.ClienteTelefono || "");
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
                setClienteRUC(clienteCreado.ClienteRUC || "");
                setTelefono(clienteCreado.ClienteTelefono || "");
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
