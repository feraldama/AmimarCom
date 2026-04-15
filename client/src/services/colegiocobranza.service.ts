import api from "./api";
import type { AxiosError } from "axios";

export const getColegioCobranzas = async (
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
    const response = await api.get("/colegiocobranza", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener cobranzas",
      }
    );
  }
};

export const searchColegioCobranzas = async (
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
    const response = await api.get(`/colegiocobranza/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar cobranzas",
      }
    );
  }
};

export const getColegioCobranzaById = async (id: string | number) => {
  try {
    const response = await api.get(`/colegiocobranza/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener la cobranza",
      }
    );
  }
};

export const createColegioCobranza = async (
  cobranzaData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/colegiocobranza", cobranzaData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al crear la cobranza",
      }
    );
  }
};

export const updateColegioCobranza = async (
  id: string | number,
  cobranzaData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/colegiocobranza/${id}`, cobranzaData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar la cobranza",
      }
    );
  }
};

export const deleteColegioCobranza = async (id: string | number) => {
  try {
    const response = await api.delete(`/colegiocobranza/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar la cobranza",
      }
    );
  }
};
