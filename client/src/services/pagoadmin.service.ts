import api from "./api";
import type { AxiosError } from "axios";

export const getPagosAdmin = async (
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
    const response = await api.get("/pagoadmin", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener pagos admin",
      }
    );
  }
};

export const searchPagosAdmin = async (
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
    const response = await api.get(`/pagoadmin/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar pagos admin",
      }
    );
  }
};

export const getPagoAdminById = async (id: string | number) => {
  try {
    const response = await api.get(`/pagoadmin/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener el pago admin" }
    );
  }
};

export const createPagoAdmin = async (
  pagoAdminData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/pagoadmin", pagoAdminData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear el pago admin" }
    );
  }
};

export const updatePagoAdmin = async (
  id: string | number,
  pagoAdminData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/pagoadmin/${id}`, pagoAdminData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar el pago admin",
      }
    );
  }
};

export const deletePagoAdmin = async (id: string | number) => {
  try {
    const response = await api.delete(`/pagoadmin/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar el pago admin" }
    );
  }
};
