import api from "./api";
import type { AxiosError } from "axios";

export const getDivisaMovimientos = async (
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
