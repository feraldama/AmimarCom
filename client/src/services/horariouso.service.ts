import api from "./api";
import type { AxiosError } from "axios";

export const getHorariosUso = async (
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
    const response = await api.get("/horariouso", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener horarios" }
    );
  }
};

export const getHorarioUsoById = async (id: string | number) => {
  try {
    const response = await api.get(`/horariouso/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener horario" }
    );
  }
};

export const createHorarioUso = async (
  horarioUsoData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/horariouso", horarioUsoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear horario" }
    );
  }
};

export const updateHorarioUso = async (
  id: string | number,
  horarioUsoData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/horariouso/${id}`, horarioUsoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al actualizar horario" }
    );
  }
};

export const deleteHorarioUso = async (id: string | number) => {
  try {
    const response = await api.delete(`/horariouso/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar horario" }
    );
  }
};

export const searchHorariosUso = async (
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
    const response = await api.get("/horariouso/search", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al buscar horarios" }
    );
  }
};
