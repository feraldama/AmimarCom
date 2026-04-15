import api from "./api";
import type { AxiosError } from "axios";

export const getNominas = async (
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
    const response = await api.get("/nomina", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener nominas",
      }
    );
  }
};

export const searchNominas = async (
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
    const response = await api.get(`/nomina/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar nominas",
      }
    );
  }
};

export const getNominaById = async (id: string | number) => {
  try {
    const response = await api.get(`/nomina/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener la nomina" }
    );
  }
};

export const createNomina = async (nominaData: Record<string, unknown>) => {
  try {
    const response = await api.post("/nomina", nominaData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al crear la nomina" };
  }
};

export const updateNomina = async (
  id: string | number,
  nominaData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/nomina/${id}`, nominaData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar la nomina",
      }
    );
  }
};

export const deleteNomina = async (id: string | number) => {
  try {
    const response = await api.delete(`/nomina/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar la nomina" }
    );
  }
};

export const getAllNominasSinPaginacion = async () => {
  try {
    const response = await api.get("/nomina/all");
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener todas las nominas",
      }
    );
  }
};
