import api from "./api";
import type { AxiosError } from "axios";

export const getTransportes = async (
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
    const response = await api.get("/transporte", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener transportes" }
    );
  }
};

export const getTransporteById = async (id: string | number) => {
  try {
    const response = await api.get(`/transporte/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener transporte" }
    );
  }
};

export const createTransporte = async (
  transporteData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/transporte", transporteData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al crear transporte" };
  }
};

export const updateTransporte = async (
  id: string | number,
  transporteData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/transporte/${id}`, transporteData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al actualizar transporte" }
    );
  }
};

export const deleteTransporte = async (id: string | number) => {
  try {
    const response = await api.delete(`/transporte/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar transporte" }
    );
  }
};

export const searchTransportes = async (
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
    const response = await api.get(`/transporte/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al buscar transportes" }
    );
  }
};
