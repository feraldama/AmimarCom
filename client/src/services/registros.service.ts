import api from "./api";
import type { AxiosError } from "axios";

export const getRegistrosDiariosCaja = async (
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
) => {
  const params: { [key: string]: string | number | undefined } = {
    page,
    limit,
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  try {
    const response = await api.get("/registrodiariocaja", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener registros diarios de caja",
      }
    );
  }
};

export const searchRegistrosDiariosCaja = async (
  searchTerm: string,
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
) => {
  const params: { [key: string]: string | number | undefined } = {
    q: searchTerm,
    page,
    limit,
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  try {
    const response = await api.get(`/registrodiariocaja/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar registros diarios de caja",
      }
    );
  }
};

export const getRegistroDiarioCajaById = async (id: string | number) => {
  try {
    const response = await api.get(`/registrodiariocaja/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener el registro" }
    );
  }
};

export const createRegistroDiarioCaja = async (
  registroData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/registrodiariocaja", registroData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear el registro" }
    );
  }
};

export const updateRegistroDiarioCaja = async (
  id: string | number,
  registroData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/registrodiariocaja/${id}`, registroData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar el registro",
      }
    );
  }
};

export const deleteRegistroDiarioCaja = async (id: string | number) => {
  try {
    const response = await api.delete(`/registrodiariocaja/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar el registro" }
    );
  }
};

export const findRegistroDiarioCajaByDivisaMovimientoId = async (
  divisaMovimientoId: string | number
) => {
  try {
    // Buscar registros que contengan "DivisaMovimientoId:X" en el detalle
    // Ahora puede tener "Compra DivisaMovimientoId:X" o "Venta DivisaMovimientoId:X"
    const searchTerm = `DivisaMovimientoId:${divisaMovimientoId}`;
    const response = await searchRegistrosDiariosCaja(searchTerm, 1, 100);

    // Filtrar para encontrar el registro que contenga el patrón
    // Puede ser "Compra DivisaMovimientoId:X" o "Venta DivisaMovimientoId:X"
    const registros = response.data || [];
    const registroEncontrado = registros.find(
      (reg: { RegistroDiarioCajaDetalle?: string }) => {
        const detalle = reg.RegistroDiarioCajaDetalle || "";
        // Buscar que contenga "DivisaMovimientoId:X" (puede tener "Compra" o "Venta" antes)
        return detalle.includes(searchTerm);
      }
    );

    return registroEncontrado || null;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar registro diario de caja",
      }
    );
  }
};

export const getReportePaseCajas = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get("/registrodiariocaja/reporte-pase-cajas", {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de pase de cajas",
      }
    );
  }
};

export const getReporteMovimientosCajas = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get(
      "/registrodiariocaja/reporte-movimientos-cajas",
      {
        params: { fechaInicio, fechaFin },
      }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de movimientos de cajas",
      }
    );
  }
};

export const getReporteCierreDiario = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get(
      "/registrodiariocaja/reporte-cierre-diario",
      { params: { fechaInicio, fechaFin } }
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de cierre diario",
      }
    );
  }
};

export const getReporteVentasPorTipoPago = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get("/venta/reporte-tipo-pago", {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de ventas por tipo de pago",
      }
    );
  }
};

export const getReporteVentasPorUsuario = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get("/venta/reporte-por-usuario", {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de ventas por usuario",
      }
    );
  }
};

export const getReporteDeudasPendientes = async () => {
  try {
    const response = await api.get("/venta/reporte-deudas");
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de deudas pendientes",
      }
    );
  }
};

export const getReporteDivisas = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get("/divisamovimiento/reporte-historial", {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de divisas",
      }
    );
  }
};
