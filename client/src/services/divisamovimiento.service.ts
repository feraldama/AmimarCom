import api from "./api";
import type { AxiosError } from "axios";

export interface DivisaMovimientoFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  cajaId?: string | number;
  divisaId?: string | number;
  divisaMovimientoTipo?: string;
}

const buildFiltrosParams = (filtros?: DivisaMovimientoFiltros) => {
  const params: { [key: string]: string | number } = {};
  if (!filtros) return params;
  if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
  if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
  if (filtros.cajaId) params.cajaId = filtros.cajaId;
  if (filtros.divisaId) params.divisaId = filtros.divisaId;
  if (filtros.divisaMovimientoTipo)
    params.divisaMovimientoTipo = filtros.divisaMovimientoTipo;
  return params;
};

export const getDivisaMovimientos = async (
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  filtros?: DivisaMovimientoFiltros
) => {
  const params: { [key: string]: string | number | undefined } = {
    page,
    limit,
    ...buildFiltrosParams(filtros),
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  try {
    const response = await api.get("/divisamovimiento", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener movimientos de divisa",
      }
    );
  }
};

export const getDivisaMovimientoById = async (id: string | number) => {
  try {
    const response = await api.get(`/divisamovimiento/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener movimiento de divisa",
      }
    );
  }
};

export const createDivisaMovimiento = async (
  divisaMovimientoData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/divisamovimiento", divisaMovimientoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al crear movimiento de divisa",
      }
    );
  }
};

export const updateDivisaMovimiento = async (
  id: string | number,
  divisaMovimientoData: Record<string, unknown>
) => {
  try {
    const response = await api.put(
      `/divisamovimiento/${id}`,
      divisaMovimientoData
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar movimiento de divisa",
      }
    );
  }
};

export const deleteDivisaMovimiento = async (id: string | number) => {
  try {
    const response = await api.delete(`/divisamovimiento/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar movimiento de divisa",
      }
    );
  }
};

export const searchDivisaMovimientos = async (
  searchTerm: string,
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  filtros?: DivisaMovimientoFiltros
) => {
  const params: { [key: string]: string | number | undefined } = {
    q: searchTerm,
    page,
    limit,
    ...buildFiltrosParams(filtros),
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  try {
    const response = await api.get(`/divisamovimiento/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar movimientos de divisa",
      }
    );
  }
};
