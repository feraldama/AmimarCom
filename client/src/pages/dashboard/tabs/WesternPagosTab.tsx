import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById } from "../../../services/cajas.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import { getTiposGasto } from "../../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../../services/tipogastogrupo.service";
import { updateCajaMonto } from "../../../services/cajas.service";
import { getCajaGastosByTipoGastoAndGrupo } from "../../../services/cajagasto.service";
import { createWesternEnvio } from "../../../services/westernenvio.service";
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

interface TipoGasto {
  TipoGastoId: number;
  TipoGastoDescripcion: string;
}

interface TipoGastoGrupo {
  TipoGastoGrupoId: number;
  TipoGastoGrupoDescripcion: string;
  TipoGastoId: number;
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

export default function WesternPagosTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showClienteModalPagos, setShowClienteModalPagos] = useState(false);
  const [showClienteModalEnvios, setShowClienteModalEnvios] = useState(false);
  const [clienteSeleccionadoPagos, setClienteSeleccionadoPagos] =
    useState<Cliente | null>(null);
  const [clienteSeleccionadoEnvios, setClienteSeleccionadoEnvios] =
    useState<Cliente | null>(null);
  const [clienteRUCPagos, setClienteRUCPagos] = useState("");
  const [telefonoPagos, setTelefonoPagos] = useState("");
  const [clienteRUCEnvios, setClienteRUCEnvios] = useState("");
  const [telefonoEnvios, setTelefonoEnvios] = useState("");

  // Formulario Pagos (tipogastoid = 1)
  const [cajaIdPagos, setCajaIdPagos] = useState<string | number>("");
  const [fechaPagos, setFechaPagos] = useState("");
  const tipoGastoIdPagos = 1; // Fijo en 1
  const [tipoGastoGrupoIdPagos, setTipoGastoGrupoIdPagos] = useState<
    number | ""
  >("");
  const [cambioDolarPagos, setCambioDolarPagos] = useState<number | "">("");
  const [detallePagos, setDetallePagos] = useState("");
  const [mtcnPagos, setMtcnPagos] = useState<number | "">("");
  const [cargoEnvioPagos, setCargoEnvioPagos] = useState<number | "">("");
  const [montoPagos, setMontoPagos] = useState<number | "">("");
  const [valorEspecialPagos, setValorEspecialPagos] = useState<number | "">("");

  // Formulario Envíos (tipogastoid = 2)
  const [cajaIdEnvios, setCajaIdEnvios] = useState<string | number>("");
  const [fechaEnvios, setFechaEnvios] = useState("");
  const tipoGastoIdEnvios = 2; // Fijo en 2
  const [tipoGastoGrupoIdEnvios, setTipoGastoGrupoIdEnvios] = useState<
    number | ""
  >("");
  const [cambioDolarEnvios, setCambioDolarEnvios] = useState<number | "">("");
  const [detalleEnvios, setDetalleEnvios] = useState("");
  const [mtcnEnvios, setMtcnEnvios] = useState<number | "">("");
  const [cargoEnvioEnvios, setCargoEnvioEnvios] = useState<number | "">("");
  const [montoEnvios, setMontoEnvios] = useState<number | "">("");
  const [valorEspecialEnvios, setValorEspecialEnvios] = useState<number | "">("");

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener caja aperturada
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
          setCajaIdPagos(estado.cajaId);
          setCajaIdEnvios(estado.cajaId);
        } else {
          setCajaAperturada(null);
        }

        // Obtener tipos de gasto y grupos
        const tiposGastoData = await getTiposGasto();
        setTiposGasto(tiposGastoData);
        const tiposGastoGrupoData = await getTiposGastoGrupo();
        setTiposGastoGrupo(tiposGastoGrupoData);

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
        const fechaInicial = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        setFechaPagos(fechaInicial);
        setFechaEnvios(fechaInicial);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  // Limpiar valor especial y monto cuando cambie el grupo en pagos
  useEffect(() => {
    setValorEspecialPagos("");
    setMontoPagos("");
    // Limpiar cambio dolar cuando es grupo 13
    if (tipoGastoIdPagos === 1 && tipoGastoGrupoIdPagos === 13) {
      setCambioDolarPagos("");
    }
  }, [tipoGastoGrupoIdPagos, tipoGastoIdPagos]);

  // Limpiar valor especial y monto cuando cambie el grupo en envíos
  useEffect(() => {
    setValorEspecialEnvios("");
    setMontoEnvios("");
    // Limpiar cambio dolar cuando es grupo 13
    if (tipoGastoIdEnvios === 2 && tipoGastoGrupoIdEnvios === 13) {
      setCambioDolarEnvios("");
    }
  }, [tipoGastoGrupoIdEnvios, tipoGastoIdEnvios]);

  // Calcular monto automáticamente para pagos cuando TipoGastoId=1 y TipoGastoGrupoId=19
  useEffect(() => {
    if (tipoGastoIdPagos === 1 && tipoGastoGrupoIdPagos === 19) {
      if (valorEspecialPagos !== "" && cambioDolarPagos !== "" && cambioDolarPagos !== 0) {
        const montoCalculado = Number(valorEspecialPagos) * Number(cambioDolarPagos);
        setMontoPagos(montoCalculado);
      } else {
        setMontoPagos("");
      }
    }
  }, [valorEspecialPagos, cambioDolarPagos, tipoGastoIdPagos, tipoGastoGrupoIdPagos]);

  // Calcular monto automáticamente para envíos cuando TipoGastoId=2 y TipoGastoGrupoId=24
  useEffect(() => {
    if (tipoGastoIdEnvios === 2 && tipoGastoGrupoIdEnvios === 24) {
      if (valorEspecialEnvios !== "" && cambioDolarEnvios !== "" && cambioDolarEnvios !== 0) {
        const montoCalculado = Number(valorEspecialEnvios) * Number(cambioDolarEnvios);
        setMontoEnvios(montoCalculado);
      } else {
        setMontoEnvios("");
      }
    }
  }, [valorEspecialEnvios, cambioDolarEnvios, tipoGastoIdEnvios, tipoGastoGrupoIdEnvios]);

  // Filtrar grupos: solo los que tienen "western" en TipoGastoGrupoDescripcion y coinciden con el tipoGastoId
  const gruposFiltradosPagos = tiposGastoGrupo
    .filter(
      (g) =>
        g.TipoGastoId === tipoGastoIdPagos &&
        g.TipoGastoGrupoDescripcion.toLowerCase().includes("western")
    )
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  const gruposFiltradosEnvios = tiposGastoGrupo
    .filter(
      (g) =>
        g.TipoGastoId === tipoGastoIdEnvios &&
        g.TipoGastoGrupoDescripcion.toLowerCase().includes("western")
    )
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  const handleSubmitPagos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar pagos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoIdPagos,
        tipoGastoGrupoIdPagos
      );

      // Crear el registro diario de caja
      await createRegistroDiarioCaja({
        CajaId: cajaIdPagos,
        RegistroDiarioCajaFecha: fechaPagos,
        TipoGastoId: tipoGastoIdPagos,
        TipoGastoGrupoId: tipoGastoGrupoIdPagos,
        RegistroDiarioCajaDetalle: detallePagos,
        RegistroDiarioCajaMonto: montoPagos,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: cambioDolarPagos || 0,
        RegistroDiarioCajaMTCN: mtcnPagos || 0,
        RegistroDiarioCajaCargoEnvio: 0, // No se usa en Pagos
      });

      // Crear registro en westernenvio para pagos (TipoGastoId=1)
      await createWesternEnvio({
        CajaId: cajaIdPagos,
        WesternEnvioFecha: fechaPagos,
        TipoGastoId: tipoGastoIdPagos, // 1 para pagos
        TipoGastoGrupoId: tipoGastoGrupoIdPagos,
        WesternEnvioCambio: cambioDolarPagos || 0,
        WesternEnvioDetalle: detallePagos,
        WesternEnvioMTCN: mtcnPagos || 0,
        WesternEnvioCargoEnvio: 0,
        WesternEnvioFactura: "",
        WesternEnvioTimbrado: "",
        WesternEnvioMonto: montoPagos,
        WesternEnvioUsuarioId: user.id,
        ClienteId: clienteSeleccionadoPagos
          ? Number(clienteSeleccionadoPagos.ClienteId)
          : null,
      });

      // Obtener IDs únicos de todas las cajas que tienen el gasto asignado
      const cajasIdsConGasto = new Set<number>();
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      });

      const montoNumero = Number(montoPagos);
      const cambioDolarNumero = Number(cambioDolarPagos) || 1; // Si no hay cambio, usar 1 para evitar división por 0
      const cajaIdNumero = Number(cajaIdPagos);

      // Verificar casos especiales
      const esCasoEspecial19 = tipoGastoIdPagos === 1 && tipoGastoGrupoIdPagos === 19;
      const esCasoEspecial13 = tipoGastoIdPagos === 1 && tipoGastoGrupoIdPagos === 13;
      const esCasoEspecial4 = tipoGastoIdPagos === 1 && tipoGastoGrupoIdPagos === 4; // PAGOS: sumar a demás cajas

      // Actualizar la caja aperturada (mantener lógica actual)
      if (!esCasoEspecial13) {
        // Caso especial 13: no tocar la caja aperturada
        // Otros casos: restar el monto (Egreso)
        const cajaAperturadaActual = await getCajaById(cajaIdNumero);
        const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
        const cajaAperturadaTipoId = cajaAperturadaActual.CajaTipoId;
        
        // Si CajaTipoId=3, hacer operación opuesta (sumar en lugar de restar)
        const montoAplicar = cajaAperturadaTipoId === 3 ? montoNumero : -montoNumero;
        await updateCajaMonto(
          cajaIdNumero,
          cajaAperturadaMontoActual + montoAplicar
        );
      }

      // Actualizar las demás cajas
      const cajasParaActualizar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdNumero
      );

      if (cajasParaActualizar.length > 0) {
        const actualizaciones = cajasParaActualizar.map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            const cajaTipoId = cajaActual.CajaTipoId;

            if (esCasoEspecial19 || esCasoEspecial13) {
              // Casos especiales 19 y 13: sumar Monto/CambioDolar
              const montoConvertido = montoNumero / cambioDolarNumero;
              // Si CajaTipoId=3, hacer operación opuesta (restar en lugar de sumar)
              const montoAplicar = cajaTipoId === 3 ? -montoConvertido : montoConvertido;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            } else if (esCasoEspecial4) {
              // Caso especial 4 (PAGOS): SUMAR el monto a las demás cajas (misma lógica que CobranzaTab para EGRESO)
              // Si CajaTipoId=3, hacer operación opuesta (restar en lugar de sumar)
              const montoAplicar = cajaTipoId === 3 ? -montoNumero : montoNumero;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            } else {
              // Caso normal: restar el monto (Egreso)
              // Si CajaTipoId=3, hacer operación opuesta (sumar en lugar de restar)
              const montoAplicar = cajaTipoId === 3 ? montoNumero : -montoNumero;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            }
          }
        );

        await Promise.all(actualizaciones);
      }

      Swal.fire(
        "Pago registrado",
        "El pago fue registrado correctamente",
        "success"
      );

      // Limpiar formulario
      setTipoGastoGrupoIdPagos("");
      setCambioDolarPagos("");
      setDetallePagos("");
      setMtcnPagos("");
      setCargoEnvioPagos("");
      setMontoPagos("");
      setValorEspecialPagos("");
      setClienteSeleccionadoPagos(null);
      setClienteRUCPagos("");
      setTelefonoPagos("");

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaPagos(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar el pago";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleSubmitEnvios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar envíos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        tipoGastoIdEnvios,
        tipoGastoGrupoIdEnvios
      );

      // Crear el registro diario de caja
      await createRegistroDiarioCaja({
        CajaId: cajaIdEnvios,
        RegistroDiarioCajaFecha: fechaEnvios,
        TipoGastoId: tipoGastoIdEnvios,
        TipoGastoGrupoId: tipoGastoGrupoIdEnvios,
        RegistroDiarioCajaDetalle: detalleEnvios,
        RegistroDiarioCajaMonto: montoEnvios,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: cambioDolarEnvios || 0,
        RegistroDiarioCajaMTCN: mtcnEnvios || 0,
        RegistroDiarioCajaCargoEnvio: cargoEnvioEnvios || 0,
      });

      // Crear registro en westernenvio para envíos (TipoGastoId=2)
      await createWesternEnvio({
        CajaId: cajaIdEnvios,
        WesternEnvioFecha: fechaEnvios,
        TipoGastoId: tipoGastoIdEnvios, // 2 para envíos
        TipoGastoGrupoId: tipoGastoGrupoIdEnvios,
        WesternEnvioCambio: cambioDolarEnvios || 0,
        WesternEnvioDetalle: detalleEnvios,
        WesternEnvioMTCN: mtcnEnvios || 0,
        WesternEnvioCargoEnvio: cargoEnvioEnvios || 0,
        WesternEnvioFactura: "",
        WesternEnvioTimbrado: "",
        WesternEnvioMonto: montoEnvios,
        WesternEnvioUsuarioId: user.id,
        ClienteId: clienteSeleccionadoEnvios
          ? Number(clienteSeleccionadoEnvios.ClienteId)
          : null,
      });

      // Obtener IDs únicos de todas las cajas que tienen el gasto asignado
      const cajasIdsConGasto = new Set<number>();
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      });

      const montoNumero = Number(montoEnvios);
      const cambioDolarNumero = Number(cambioDolarEnvios) || 1; // Si no hay cambio, usar 1 para evitar división por 0
      const cajaIdNumero = Number(cajaIdEnvios);

      // Verificar casos especiales (opuestos a los de pagos)
      const esCasoEspecial24 = tipoGastoIdEnvios === 2 && tipoGastoGrupoIdEnvios === 24;
      const esCasoEspecial13 = tipoGastoIdEnvios === 2 && tipoGastoGrupoIdEnvios === 13;
      const esCasoEspecial5 = tipoGastoIdEnvios === 2 && tipoGastoGrupoIdEnvios === 5; // ENVÍOS: restar a demás cajas

      // Actualizar la caja aperturada (mantener lógica actual)
      if (!esCasoEspecial13) {
        // Caso especial 13: no tocar la caja aperturada
        // Otros casos: sumar el monto (Ingreso)
        const cajaAperturadaActual = await getCajaById(cajaIdNumero);
        const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
        const cajaAperturadaTipoId = cajaAperturadaActual.CajaTipoId;
        
        // Si CajaTipoId=3, hacer operación opuesta (restar en lugar de sumar)
        const montoAplicar = cajaAperturadaTipoId === 3 ? -montoNumero : montoNumero;
        await updateCajaMonto(
          cajaIdNumero,
          cajaAperturadaMontoActual + montoAplicar
        );
      }

      // Actualizar las demás cajas
      const cajasParaActualizar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdNumero
      );

      if (cajasParaActualizar.length > 0) {
        const actualizaciones = cajasParaActualizar.map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            const cajaTipoId = cajaActual.CajaTipoId;

            if (esCasoEspecial24 || esCasoEspecial13) {
              // Casos especiales 24 y 13: restar Monto/CambioDolar (opuesto a pagos que suma)
              const montoConvertido = montoNumero / cambioDolarNumero;
              // Si CajaTipoId=3, hacer operación opuesta (sumar en lugar de restar)
              const montoAplicar = cajaTipoId === 3 ? montoConvertido : -montoConvertido;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            } else if (esCasoEspecial5) {
              // Caso especial 5 (ENVÍOS): RESTAR el monto a las demás cajas (misma lógica que CobranzaTab para INGRESO)
              // Si CajaTipoId=3, hacer operación opuesta (sumar en lugar de restar)
              const montoAplicar = cajaTipoId === 3 ? montoNumero : -montoNumero;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            } else {
              // Caso normal: sumar el monto (Ingreso)
              // Si CajaTipoId=3, hacer operación opuesta (restar en lugar de sumar)
              const montoAplicar = cajaTipoId === 3 ? -montoNumero : montoNumero;
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + montoAplicar
              );
            }
          }
        );

        await Promise.all(actualizaciones);
      }

      Swal.fire(
        "Envío registrado",
        "El envío fue registrado correctamente",
        "success"
      );

      // Limpiar formulario
      setTipoGastoGrupoIdEnvios("");
      setCambioDolarEnvios("");
      setDetalleEnvios("");
      setMtcnEnvios("");
      setCargoEnvioEnvios("");
      setMontoEnvios("");
      setValorEspecialEnvios("");
      setClienteSeleccionadoEnvios(null);
      setClienteRUCEnvios("");
      setTelefonoEnvios("");

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaEnvios(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar el envío";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleCancelPagos = () => {
    setTipoGastoGrupoIdPagos("");
    setCambioDolarPagos("");
    setDetallePagos("");
    setMtcnPagos("");
    setCargoEnvioPagos("");
    setMontoPagos("");
    setValorEspecialPagos("");
    setClienteSeleccionadoPagos(null);
    setClienteRUCPagos("");
    setTelefonoPagos("");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaPagos(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const handleCancelEnvios = () => {
    setTipoGastoGrupoIdEnvios("");
    setCambioDolarEnvios("");
    setDetalleEnvios("");
    setMtcnEnvios("");
    setCargoEnvioEnvios("");
    setMontoEnvios("");
    setValorEspecialEnvios("");
    setClienteSeleccionadoEnvios(null);
    setClienteRUCEnvios("");
    setTelefonoEnvios("");
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaEnvios(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const renderForm = (
    titulo: string,
    fecha: string,
    setFecha: (value: string) => void,
    tipoGastoId: number,
    tipoGastoGrupoId: number | "",
    setTipoGastoGrupoId: (value: number | "") => void,
    cambioDolar: number | "",
    setCambioDolar: (value: number | "") => void,
    detalle: string,
    setDetalle: (value: string) => void,
    mtcn: number | "",
    setMtcn: (value: number | "") => void,
    cargoEnvio: number | "",
    setCargoEnvio: (value: number | "") => void,
    monto: number | "",
    setMonto: (value: number | "") => void,
    clienteSeleccionado: Cliente | null,
    setClienteSeleccionado: (value: Cliente | null) => void,
    showClienteModal: boolean,
    setShowClienteModal: (value: boolean) => void,
    clienteRUC: string,
    setClienteRUC: (value: string) => void,
    telefono: string,
    setTelefono: (value: string) => void,
    gruposFiltrados: TipoGastoGrupo[],
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void,
    mostrarMTCN: boolean = true,
    mtcnRequired: boolean = false,
    mostrarCargoEnvio: boolean = true,
    valorEspecial: number | "" = "",
    setValorEspecial: (value: number | "") => void = () => {}
  ) => {
    // Determinar si debe mostrar el input especial
    const mostrarInputEspecial = 
      (tipoGastoId === 1 && tipoGastoGrupoId === 19) ||
      (tipoGastoId === 2 && tipoGastoGrupoId === 24);
    
    // Determinar si debe ocultar el cambio dolar (grupo 13)
    const ocultarCambioDolar = 
      (tipoGastoId === 1 && tipoGastoGrupoId === 13) ||
      (tipoGastoId === 2 && tipoGastoGrupoId === 13);

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

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grupo
            </label>
            <select
              value={tipoGastoGrupoId}
              onChange={(e) => setTipoGastoGrupoId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seleccione...</option>
              {gruposFiltrados.map((gg) => (
                <option key={gg.TipoGastoGrupoId} value={gg.TipoGastoGrupoId}>
                  {gg.TipoGastoGrupoDescripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Cambio Dolar */}
          {!ocultarCambioDolar && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cambio Dolar
              </label>
              <input
                type="text"
                value={cambioDolar !== "" ? formatMiles(cambioDolar) : ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/,/g, ".");
                  const num = Number(raw);
                  setCambioDolar(isNaN(num) ? "" : num);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                inputMode="numeric"
              />
            </div>
          )}

          {/* MTCN */}
          {mostrarMTCN && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MTCN
              </label>
              <input
                type="number"
                value={mtcn}
                onChange={(e) =>
                  setMtcn(e.target.value ? Number(e.target.value) : "")
                }
                required={mtcnRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Cargo Envio */}
          {mostrarCargoEnvio && (
            <div>
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
            </div>
          )}

          {/* Input Especial - Solo para casos específicos */}
          {mostrarInputEspecial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dólares (se calculará Monto = Dólares × Cambio Dolar)
              </label>
              <input
                type="text"
                value={valorEspecial !== "" ? formatMiles(valorEspecial) : ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/,/g, ".");
                  const num = Number(raw);
                  setValorEspecial(isNaN(num) ? "" : num);
                }}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                inputMode="numeric"
              />
            </div>
          )}

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
              disabled={mostrarInputEspecial}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                mostrarInputEspecial ? "bg-gray-100 text-gray-600 cursor-not-allowed" : ""
              }`}
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Formularios de Pagos y Envíos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda - Pagos */}
        <div>
          {renderForm(
            "Western Pagos",
            fechaPagos,
            setFechaPagos,
            tipoGastoIdPagos,
            tipoGastoGrupoIdPagos,
            setTipoGastoGrupoIdPagos,
            cambioDolarPagos,
            setCambioDolarPagos,
            detallePagos,
            setDetallePagos,
            mtcnPagos,
            setMtcnPagos,
            cargoEnvioPagos,
            setCargoEnvioPagos,
            montoPagos,
            setMontoPagos,
            clienteSeleccionadoPagos,
            setClienteSeleccionadoPagos,
            showClienteModalPagos,
            setShowClienteModalPagos,
            clienteRUCPagos,
            setClienteRUCPagos,
            telefonoPagos,
            setTelefonoPagos,
            gruposFiltradosPagos,
            handleSubmitPagos,
            handleCancelPagos,
            true, // Mostrar MTCN para Pagos
            true, // MTCN requerido para Pagos
            false, // No mostrar Cargo Envío para Pagos
            valorEspecialPagos,
            setValorEspecialPagos
          )}
        </div>

        {/* Columna Derecha - Envíos */}
        <div>
          {renderForm(
            "Western Envíos",
            fechaEnvios,
            setFechaEnvios,
            tipoGastoIdEnvios,
            tipoGastoGrupoIdEnvios,
            setTipoGastoGrupoIdEnvios,
            cambioDolarEnvios,
            setCambioDolarEnvios,
            detalleEnvios,
            setDetalleEnvios,
            mtcnEnvios,
            setMtcnEnvios,
            cargoEnvioEnvios,
            setCargoEnvioEnvios,
            montoEnvios,
            setMontoEnvios,
            clienteSeleccionadoEnvios,
            setClienteSeleccionadoEnvios,
            showClienteModalEnvios,
            setShowClienteModalEnvios,
            clienteRUCEnvios,
            setClienteRUCEnvios,
            telefonoEnvios,
            setTelefonoEnvios,
            gruposFiltradosEnvios,
            handleSubmitEnvios,
            handleCancelEnvios,
            true, // Mostrar MTCN para Envíos
            true, // MTCN requerido para Envíos
            true, // Mostrar Cargo Envío para Envíos
            valorEspecialEnvios,
            setValorEspecialEnvios
          )}
        </div>
      </div>
    </div>
  );
}
