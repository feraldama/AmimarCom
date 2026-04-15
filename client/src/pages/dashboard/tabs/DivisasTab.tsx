import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import {
  getCajaById,
  updateCajaMonto,
  getCajas,
} from "../../../services/cajas.service";
import { getDivisas } from "../../../services/divisa.service";
import { createDivisaMovimiento } from "../../../services/divisamovimiento.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import { getDivisaGastosByDivisaId } from "../../../services/divisagasto.service";
import { getCajaGastosByTipoGastoAndGrupo } from "../../../services/cajagasto.service";
import Swal from "sweetalert2";
import { formatMiles } from "../../../utils/utils";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  [key: string]: unknown;
}

interface Divisa {
  DivisaId: number;
  DivisaNombre: string;
  DivisaCompraMonto: number;
  DivisaVentaMonto: number;
}

export default function DivisasTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [divisas, setDivisas] = useState<Divisa[]>([]);
  const [todasLasCajas, setTodasLasCajas] = useState<Caja[]>([]);

  // Formulario Compra
  const [fechaCompra, setFechaCompra] = useState("");
  const [divisaIdCompra, setDivisaIdCompra] = useState<number | "">("");
  const [cambioCompra, setCambioCompra] = useState<number | "">("");
  const [cantidadCompra, setCantidadCompra] = useState<number | "">("");
  const [montoCompra, setMontoCompra] = useState<number>(0);

  // Formulario Venta
  const [fechaVenta, setFechaVenta] = useState("");
  const [divisaIdVenta, setDivisaIdVenta] = useState<number | "">("");
  const [cambioVenta, setCambioVenta] = useState<number | "">("");
  const [cantidadVenta, setCantidadVenta] = useState<number | "">("");
  const [montoVenta, setMontoVenta] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener caja aperturada
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
        } else {
          setCajaAperturada(null);
        }

        // Obtener divisas
        const divisasData = await getDivisas(1, 1000);
        setDivisas(divisasData.data || []);

        // Obtener todas las cajas para buscar la caja de divisa
        const cajasData = await getCajas(1, 1000);
        setTodasLasCajas(cajasData.data || []);

        // Inicializar fechas actuales
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        const fechaInicial = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        setFechaCompra(fechaInicial);
        setFechaVenta(fechaInicial);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  // Actualizar cambio cuando cambia la divisa (Compra)
  useEffect(() => {
    if (divisaIdCompra) {
      const divisa = divisas.find((d) => d.DivisaId === Number(divisaIdCompra));
      if (divisa) {
        setCambioCompra(divisa.DivisaCompraMonto);
      }
    } else {
      setCambioCompra("");
    }
  }, [divisaIdCompra, divisas]);

  // Actualizar cambio cuando cambia la divisa (Venta)
  useEffect(() => {
    if (divisaIdVenta) {
      const divisa = divisas.find((d) => d.DivisaId === Number(divisaIdVenta));
      if (divisa) {
        setCambioVenta(divisa.DivisaVentaMonto);
      }
    } else {
      setCambioVenta("");
    }
  }, [divisaIdVenta, divisas]);

  // Calcular monto cuando cambian cantidad o cambio (Compra)
  useEffect(() => {
    if (cantidadCompra && cambioCompra) {
      const montoCalculado = Number(cantidadCompra) * Number(cambioCompra);
      setMontoCompra(montoCalculado);
    } else {
      setMontoCompra(0);
    }
  }, [cantidadCompra, cambioCompra]);

  // Calcular monto cuando cambian cantidad o cambio (Venta)
  useEffect(() => {
    if (cantidadVenta && cambioVenta) {
      const montoCalculado = Number(cantidadVenta) * Number(cambioVenta);
      setMontoVenta(montoCalculado);
    } else {
      setMontoVenta(0);
    }
  }, [cantidadVenta, cambioVenta]);

  const handleSubmitCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar compras de divisa.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!divisaIdCompra || !cantidadCompra || !cambioCompra) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Debes completar todos los campos requeridos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      const fechaFormateada = fechaCompra.split("T")[0];

      // Crear el movimiento de divisa
      const divisaMovimientoResponse = await createDivisaMovimiento({
        CajaId: cajaAperturada.CajaId,
        DivisaMovimientoFecha: fechaFormateada,
        DivisaMovimientoTipo: "C",
        DivisaId: divisaIdCompra,
        DivisaMovimientoCambio: cambioCompra,
        DivisaMovimientoCantidad: cantidadCompra,
        DivisaMovimientoMonto: montoCompra,
        UsuarioId: user.id,
      });

      // Obtener el ID del movimiento creado
      const divisaMovimientoId =
        divisaMovimientoResponse.data?.DivisaMovimientoId ||
        divisaMovimientoResponse.DivisaMovimientoId;

      // Obtener los gastos de la divisa
      const divisaGastos = await getDivisaGastosByDivisaId(divisaIdCompra);
      const divisaGastosData = divisaGastos.data || divisaGastos || [];

      // Para compra: TipoGastoId = 1 (Egreso) porque estás gastando dinero
      // Obtener el TipoGastoGrupoId del primer gasto de la divisa, o usar 2 por defecto
      const primerGasto =
        divisaGastosData.length > 0 ? divisaGastosData[0] : null;
      const tipoGastoIdRegistro = 1; // Siempre Egreso para compra
      const tipoGastoGrupoIdRegistro = primerGasto?.TipoGastoGrupoId || 2;

      // Crear registro diario de caja con DivisaMovimientoId en el detalle
      await createRegistroDiarioCaja({
        CajaId: cajaAperturada.CajaId,
        RegistroDiarioCajaFecha: fechaFormateada,
        TipoGastoId: tipoGastoIdRegistro,
        TipoGastoGrupoId: tipoGastoGrupoIdRegistro,
        RegistroDiarioCajaDetalle: `Compra DivisaMovimientoId:${divisaMovimientoId}`,
        RegistroDiarioCajaMonto: montoCompra,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: cambioCompra || 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas a actualizar
      const cajasIdsParaActualizar = new Set<number>();

      // Procesar cada gasto de la divisa
      for (const divisaGasto of divisaGastosData) {
        const tipoGastoId = divisaGasto.TipoGastoId;
        const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

        if (!tipoGastoId || !tipoGastoGrupoId) continue;

        // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId
        const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
          tipoGastoId,
          tipoGastoGrupoId
        );
        const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

        // Agregar todas las cajas que tengan el gasto asignado
        cajasConGastoData.forEach((cajaGasto: { CajaId: number }) => {
          cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
        });
      }

      // Agregar también la caja aperturada
      cajasIdsParaActualizar.add(Number(cajaAperturada.CajaId));

      // Actualizar el monto de todas las cajas según el TipoGastoId
      if (cajasIdsParaActualizar.size > 0) {
        const montoNumero = Number(montoCompra);
        const cantidadNumero = Number(cantidadCompra);

        // Crear un mapa de cajas con sus TipoGastoId para determinar si sumar o restar
        const cajasConTipoGasto = new Map<number, number>();

        // Procesar cada gasto para mapear las cajas con su TipoGastoId
        for (const divisaGasto of divisaGastosData) {
          const tipoGastoId = divisaGasto.TipoGastoId;
          const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

          if (!tipoGastoId || !tipoGastoGrupoId) continue;

          const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
            tipoGastoId,
            tipoGastoGrupoId
          );
          const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

          cajasConGastoData.forEach((cajaGasto: { CajaId: number }) => {
            const cajaId = Number(cajaGasto.CajaId);
            // Si la caja ya está mapeada, mantener el TipoGastoId existente
            if (!cajasConTipoGasto.has(cajaId)) {
              cajasConTipoGasto.set(cajaId, tipoGastoId);
            }
          });
        }

        // Agregar la caja aperturada con TipoGastoId = 1 (Egreso) para compra
        // Al comprar divisa, estás gastando dinero de tu caja, por lo que es un egreso
        cajasConTipoGasto.set(
          Number(cajaAperturada.CajaId),
          1 // TipoGastoId = 1 (Egreso) para compra
        );

        const actualizaciones = Array.from(cajasIdsParaActualizar).map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            const tipoGastoId = cajasConTipoGasto.get(cajaIdParaActualizar);
            const cajaTipoId = Number(cajaActual.CajaTipoId);

            // IMPORTANTE: Excluir las cajas de divisa (CajaTipoId = 3) de esta actualización
            // porque se actualizan específicamente más abajo para evitar duplicados
            if (cajaTipoId === 3) {
              return; // Saltar la actualización de cajas de divisa aquí
            }

            // Determinar qué valor usar según CajaTipoId
            // Si CajaTipoId === 3: usar DivisaMovimientoCantidad
            // Si CajaTipoId !== 3: usar DivisaMovimientoMonto
            const valorAUsar = cajaTipoId === 3 ? cantidadNumero : montoNumero;

            if (tipoGastoId === 1) {
              // Egreso: restar el valor
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual - valorAUsar
              );
            } else if (tipoGastoId === 2) {
              // Ingreso: sumar el valor
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + valorAUsar
              );
            }
          }
        );

        await Promise.all(actualizaciones);
      }

      // Actualizar la caja de divisa (CajaTipoId = 3)
      // Al comprar: la caja aperturada disminuye (ya se hizo arriba) y la caja de divisa aumenta
      // Buscar la caja de divisa usando TipoGastoId y TipoGastoGrupoId de divisagasto
      // IMPORTANTE: Solo procesar gastos de INGRESOS (TipoGastoId = 2) para actualizar la caja de divisa en compra
      if (divisaGastosData.length > 0) {
        const cantidadNumero = Number(cantidadCompra);
        const cajasDivisaEncontradas = new Set<number>(); // Para evitar actualizar la misma caja múltiples veces

        // Filtrar solo los gastos de INGRESOS (TipoGastoId = 2) para la actualización de la caja de divisa
        const gastosIngresos = divisaGastosData.filter(
          (gasto: { TipoGastoId: number }) => gasto.TipoGastoId === 2
        );

        // Para cada gasto de INGRESOS de la divisa, buscar la caja de divisa correspondiente
        for (const divisaGasto of gastosIngresos) {
          const tipoGastoId = divisaGasto.TipoGastoId;
          const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

          if (!tipoGastoId || !tipoGastoGrupoId) continue;

          // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId
          const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
            tipoGastoId,
            tipoGastoGrupoId
          );
          const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

          // Buscar la caja con CajaTipoId = 3 entre las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId
          for (const cajaGasto of cajasConGastoData) {
            const cajaId = Number(cajaGasto.CajaId);
            const caja = todasLasCajas.find((c) => c.CajaId === cajaId);

            if (caja && caja.CajaTipoId === 3 && !cajasDivisaEncontradas.has(cajaId)) {
              // Solo actualizar si no se ha actualizado antes
              const cajaDivisaActual = await getCajaById(cajaId);
              const cajaDivisaMontoActual = Number(cajaDivisaActual.CajaMonto);

              // Al comprar: sumar la cantidad a la caja de divisa
              await updateCajaMonto(
                cajaId,
                cajaDivisaMontoActual + cantidadNumero
              );
              cajasDivisaEncontradas.add(cajaId); // Marcar como actualizada
              break; // Solo actualizar una caja por cada TipoGastoId/TipoGastoGrupoId
            }
          }
        }
      }

      Swal.fire(
        "Compra registrada",
        "La compra de divisa fue registrada correctamente",
        "success"
      );

      // Limpiar formulario
      setDivisaIdCompra("");
      setCambioCompra("");
      setCantidadCompra("");
      setMontoCompra(0);

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaCompra(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar la compra";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleSubmitVenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar ventas de divisa.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!divisaIdVenta || !cantidadVenta || !cambioVenta) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Debes completar todos los campos requeridos.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      const fechaFormateada = fechaVenta.split("T")[0];

      // Crear el movimiento de divisa
      const divisaMovimientoResponse = await createDivisaMovimiento({
        CajaId: cajaAperturada.CajaId,
        DivisaMovimientoFecha: fechaFormateada,
        DivisaMovimientoTipo: "V",
        DivisaId: divisaIdVenta,
        DivisaMovimientoCambio: cambioVenta,
        DivisaMovimientoCantidad: cantidadVenta,
        DivisaMovimientoMonto: montoVenta,
        UsuarioId: user.id,
      });

      // Obtener el ID del movimiento creado
      const divisaMovimientoId =
        divisaMovimientoResponse.data?.DivisaMovimientoId ||
        divisaMovimientoResponse.DivisaMovimientoId;

      // Obtener los gastos de la divisa
      const divisaGastos = await getDivisaGastosByDivisaId(divisaIdVenta);
      const todosLosGastos = divisaGastos.data || divisaGastos || [];

      // Para venta: filtrar solo los gastos con TipoGastoId = 2 (INGRESO)
      const divisaGastosData = todosLosGastos.filter(
        (gasto: { TipoGastoId: number }) => gasto.TipoGastoId === 2
      );

      // Para venta: TipoGastoId = 2 (Ingreso) porque estás recibiendo dinero
      // Obtener el TipoGastoGrupoId del primer gasto de ingreso de la divisa, o usar 2 por defecto
      const primerGasto =
        divisaGastosData.length > 0 ? divisaGastosData[0] : null;
      const tipoGastoIdRegistro = 2; // Siempre Ingreso para venta
      const tipoGastoGrupoIdRegistro = primerGasto?.TipoGastoGrupoId || 2;

      // Crear registro diario de caja con DivisaMovimientoId en el detalle
      await createRegistroDiarioCaja({
        CajaId: cajaAperturada.CajaId,
        RegistroDiarioCajaFecha: fechaFormateada,
        TipoGastoId: tipoGastoIdRegistro,
        TipoGastoGrupoId: tipoGastoGrupoIdRegistro,
        RegistroDiarioCajaDetalle: `Venta DivisaMovimientoId:${divisaMovimientoId}`,
        RegistroDiarioCajaMonto: montoVenta,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: cambioVenta || 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas a actualizar
      const cajasIdsParaActualizar = new Set<number>();

      // Procesar cada gasto de la divisa
      for (const divisaGasto of divisaGastosData) {
        const tipoGastoId = divisaGasto.TipoGastoId;
        const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

        if (!tipoGastoId || !tipoGastoGrupoId) continue;

        // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId
        const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
          tipoGastoId,
          tipoGastoGrupoId
        );
        const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

        // Agregar todas las cajas que tengan el gasto asignado
        cajasConGastoData.forEach((cajaGasto: { CajaId: number }) => {
          cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
        });
      }

      // Agregar también la caja aperturada
      cajasIdsParaActualizar.add(Number(cajaAperturada.CajaId));

      // Actualizar el monto de todas las cajas según el TipoGastoId
      if (cajasIdsParaActualizar.size > 0) {
        const montoNumero = Number(montoVenta);
        const cantidadNumero = Number(cantidadVenta);

        // Crear un mapa de cajas con sus TipoGastoId para determinar si sumar o restar
        const cajasConTipoGasto = new Map<number, number>();

        // Procesar cada gasto para mapear las cajas con su TipoGastoId
        for (const divisaGasto of divisaGastosData) {
          const tipoGastoId = divisaGasto.TipoGastoId;
          const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

          if (!tipoGastoId || !tipoGastoGrupoId) continue;

          const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
            tipoGastoId,
            tipoGastoGrupoId
          );
          const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

          cajasConGastoData.forEach((cajaGasto: { CajaId: number }) => {
            const cajaId = Number(cajaGasto.CajaId);
            // Si la caja ya está mapeada, mantener el TipoGastoId existente
            if (!cajasConTipoGasto.has(cajaId)) {
              cajasConTipoGasto.set(cajaId, tipoGastoId);
            }
          });
        }

        // Agregar la caja aperturada con TipoGastoId = 2 (Ingreso) para venta
        // Al vender divisa, estás recibiendo dinero en tu caja, por lo que es un ingreso
        cajasConTipoGasto.set(
          Number(cajaAperturada.CajaId),
          2 // TipoGastoId = 2 (Ingreso) para venta
        );

        const actualizaciones = Array.from(cajasIdsParaActualizar).map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            const tipoGastoId = cajasConTipoGasto.get(cajaIdParaActualizar);
            const cajaTipoId = Number(cajaActual.CajaTipoId);

            // IMPORTANTE: Excluir las cajas de divisa (CajaTipoId = 3) de esta actualización
            // porque se actualizan específicamente más abajo para evitar duplicados
            if (cajaTipoId === 3) {
              return; // Saltar la actualización de cajas de divisa aquí
            }

            // Determinar qué valor usar según CajaTipoId
            // Si CajaTipoId === 3: usar DivisaMovimientoCantidad
            // Si CajaTipoId !== 3: usar DivisaMovimientoMonto
            const valorAUsar = cajaTipoId === 3 ? cantidadNumero : montoNumero;

            // En venta: la lógica es opuesta a compra
            // Al vender: recibes dinero (ingreso), por lo que sumas
            if (tipoGastoId === 1) {
              // Egreso: en venta esto no debería pasar normalmente, pero si pasa, restamos
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual - valorAUsar
              );
            } else if (tipoGastoId === 2) {
              // Ingreso: sumar el valor (recibes dinero al vender)
              await updateCajaMonto(
                cajaIdParaActualizar,
                cajaMontoActual + valorAUsar
              );
            }
          }
        );

        await Promise.all(actualizaciones);
      }

      // Actualizar la caja de divisa (CajaTipoId = 3)
      // Al vender: la caja aperturada aumenta (ya se hizo arriba) y la caja de divisa disminuye
      // Buscar la caja de divisa usando TipoGastoId y TipoGastoGrupoId de divisagasto
      // IMPORTANTE: Solo procesar gastos de EGRESOS (TipoGastoId = 1) para actualizar la caja de divisa en venta
      if (todosLosGastos.length > 0) {
        const cantidadNumero = Number(cantidadVenta);
        const cajasDivisaEncontradas = new Set<number>(); // Para evitar actualizar la misma caja múltiples veces

        // Filtrar solo los gastos de EGRESOS (TipoGastoId = 1) para la actualización de la caja de divisa
        const gastosEgresos = todosLosGastos.filter(
          (gasto: { TipoGastoId: number }) => gasto.TipoGastoId === 1
        );

        // Para cada gasto de EGRESOS de la divisa, buscar la caja de divisa correspondiente
        for (const divisaGasto of gastosEgresos) {
          const tipoGastoId = divisaGasto.TipoGastoId;
          const tipoGastoGrupoId = divisaGasto.TipoGastoGrupoId;

          if (!tipoGastoId || !tipoGastoGrupoId) continue;

          // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId
          const cajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
            tipoGastoId,
            tipoGastoGrupoId
          );
          const cajasConGastoData = cajasConGasto.data || cajasConGasto || [];

          // Buscar la caja con CajaTipoId = 3 entre las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId
          for (const cajaGasto of cajasConGastoData) {
            const cajaId = Number(cajaGasto.CajaId);
            const caja = todasLasCajas.find((c) => c.CajaId === cajaId);

            if (caja && caja.CajaTipoId === 3 && !cajasDivisaEncontradas.has(cajaId)) {
              // Solo actualizar si no se ha actualizado antes
              const cajaDivisaActual = await getCajaById(cajaId);
              const cajaDivisaMontoActual = Number(cajaDivisaActual.CajaMonto);

              // Al vender: restar la cantidad de la caja de divisa
              await updateCajaMonto(
                cajaId,
                cajaDivisaMontoActual - cantidadNumero
              );
              cajasDivisaEncontradas.add(cajaId); // Marcar como actualizada
              break; // Solo actualizar una caja por cada TipoGastoId/TipoGastoGrupoId
            }
          }
        }
      }

      Swal.fire(
        "Venta registrada",
        "La venta de divisa fue registrada correctamente",
        "success"
      );

      // Limpiar formulario
      setDivisaIdVenta("");
      setCambioVenta("");
      setCantidadVenta("");
      setMontoVenta(0);

      // Resetear fecha a actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFechaVenta(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar la venta";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleCancelCompra = () => {
    setDivisaIdCompra("");
    setCambioCompra("");
    setCantidadCompra("");
    setMontoCompra(0);
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaCompra(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const handleCancelVenta = () => {
    setDivisaIdVenta("");
    setCambioVenta("");
    setCantidadVenta("");
    setMontoVenta(0);
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFechaVenta(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const renderForm = (
    tipo: "Compra" | "Venta",
    fecha: string,
    setFecha: (value: string) => void,
    divisaId: number | "",
    setDivisaId: (value: number | "") => void,
    cambio: number | "",
    setCambio: (value: number | "") => void,
    cantidad: number | "",
    setCantidad: (value: number | "") => void,
    monto: number,
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void
  ) => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
        {tipo.toUpperCase()}
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

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <input
              type="text"
              value={tipo}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
          </div>

          {/* Divisa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Divisa
            </label>
            <select
              value={divisaId}
              onChange={(e) => setDivisaId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Seleccione...</option>
              {[...divisas]
                .sort((a, b) => a.DivisaNombre.localeCompare(b.DivisaNombre))
                .map((d) => (
                  <option key={d.DivisaId} value={d.DivisaId}>
                    {d.DivisaNombre}
                  </option>
                ))}
            </select>
          </div>

          {/* Cambio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cambio
            </label>
            <input
              type="text"
              value={cambio !== "" ? formatMiles(cambio) : ""}
              onChange={(e) => {
                const raw = e.target.value
                  .replace(/\./g, "")
                  .replace(/,/g, ".");
                const num = Number(raw);
                setCambio(isNaN(num) ? "" : num);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              inputMode="numeric"
            />
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad
            </label>
            <input
              type="text"
              value={cantidad !== "" ? formatMiles(cantidad) : ""}
              onChange={(e) => {
                const raw = e.target.value
                  .replace(/\./g, "")
                  .replace(/,/g, ".");
                const num = Number(raw);
                setCantidad(isNaN(num) ? "" : num);
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              inputMode="numeric"
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <input
              type="text"
              value={formatMiles(monto)}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
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

  return (
    <div className="space-y-6">
      {/* Formularios de Compra y Venta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda - Compra */}
        <div>
          {renderForm(
            "Compra",
            fechaCompra,
            setFechaCompra,
            divisaIdCompra,
            setDivisaIdCompra,
            cambioCompra,
            setCambioCompra,
            cantidadCompra,
            setCantidadCompra,
            montoCompra,
            handleSubmitCompra,
            handleCancelCompra
          )}
        </div>

        {/* Columna Derecha - Venta */}
        <div>
          {renderForm(
            "Venta",
            fechaVenta,
            setFechaVenta,
            divisaIdVenta,
            setDivisaIdVenta,
            cambioVenta,
            setCambioVenta,
            cantidadVenta,
            setCantidadVenta,
            montoVenta,
            handleSubmitVenta,
            handleCancelVenta
          )}
        </div>
      </div>

      {/* Tabla de Divisas */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
          COTIZACIÓN DE DIVISAS
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                  Divisa
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">
                  Compra
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">
                  Venta
                </th>
              </tr>
            </thead>
            <tbody>
              {[...divisas]
                .sort((a, b) => a.DivisaNombre.localeCompare(b.DivisaNombre))
                .map((divisa) => (
                  <tr
                    key={divisa.DivisaId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100">
                      {divisa.DivisaNombre}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b border-gray-100">
                      {formatMiles(divisa.DivisaCompraMonto)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b border-gray-100">
                      {formatMiles(divisa.DivisaVentaMonto)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
