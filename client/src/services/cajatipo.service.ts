import api from "./api";
import type { AxiosError } from "axios";

export const getCajaTipos = async (
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
    const response = await api.get("/cajatipo", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener tipos de caja" }
    );
  }
};

export const getCajaTipoById = async (id: string | number) => {
  try {
    const response = await api.get(`/cajatipo/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener tipo de caja" }
    );
  }
};

export const createCajaTipo = async (cajaTipoData: Record<string, unknown>) => {
  try {
    const response = await api.post("/cajatipo", cajaTipoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear tipo de caja" }
    );
  }
};

export const updateCajaTipo = async (
  id: string | number,
  cajaTipoData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/cajatipo/${id}`, cajaTipoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar tipo de caja",
      }
    );
  }
};

export const deleteCajaTipo = async (id: string | number) => {
  try {
    const response = await api.delete(`/cajatipo/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar tipo de caja" }
    );
  }
};

export const searchCajaTipos = async (
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
    const response = await api.get("/cajatipo/search", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al buscar tipos de caja" }
    );
  }
};

export const getAllCajaTipos = async () => {
  try {
    const response = await api.get("/cajatipo", { params: { limit: 1000 } });
    return response.data.data || [];
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener todos los tipos de caja",
      }
    );
  }
};
