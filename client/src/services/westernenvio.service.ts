import api from "./api";
import type { AxiosError } from "axios";

export const getWesternEnvios = async (
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
    const response = await api.get("/westernenvio", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener envíos western",
      }
    );
  }
};

export const searchWesternEnvios = async (
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
    const response = await api.get(`/westernenvio/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar envíos western",
      }
    );
  }
};

export const getWesternEnvioById = async (id: string | number) => {
  try {
    const response = await api.get(`/westernenvio/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener el envío western" }
    );
  }
};

export const createWesternEnvio = async (
  envioData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/westernenvio", envioData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear el envío western" }
    );
  }
};

export const updateWesternEnvio = async (
  id: string | number,
  envioData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/westernenvio/${id}`, envioData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar el envío western",
      }
    );
  }
};

export const deleteWesternEnvio = async (id: string | number) => {
  try {
    const response = await api.delete(`/westernenvio/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar el envío western" }
    );
  }
};
