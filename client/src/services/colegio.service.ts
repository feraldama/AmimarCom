import api from "./api";
import type { AxiosError } from "axios";

// Funciones para Colegios
export const getColegios = async (
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
    const response = await api.get("/colegio", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener colegios",
      }
    );
  }
};

export const searchColegios = async (
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
    const response = await api.get(`/colegio/search`, { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar colegios",
      }
    );
  }
};

export const getColegioById = async (id: string | number) => {
  try {
    const response = await api.get(`/colegio/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener el colegio" }
    );
  }
};

export const createColegio = async (colegioData: Record<string, unknown>) => {
  try {
    const response = await api.post("/colegio", colegioData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al crear el colegio" };
  }
};

export const updateColegio = async (
  id: string | number,
  colegioData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/colegio/${id}`, colegioData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar el colegio",
      }
    );
  }
};

export const deleteColegio = async (id: string | number) => {
  try {
    const response = await api.delete(`/colegio/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al eliminar el colegio" }
    );
  }
};

// Funciones para Cursos de Colegios
export const getColegioCursos = async (colegioId: string | number) => {
  try {
    const response = await api.get(`/colegiocurso/by-colegio/${colegioId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener los cursos del colegio",
      }
    );
  }
};

export const createColegioCurso = async (
  cursoData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/colegiocurso", cursoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al crear el curso" };
  }
};

export const updateColegioCurso = async (
  colegioId: string | number,
  cursoId: string | number,
  cursoData: Record<string, unknown>
) => {
  try {
    const response = await api.put(
      `/colegiocurso/${colegioId}/${cursoId}`,
      cursoData
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar el curso",
      }
    );
  }
};

export const deleteColegioCurso = async (
  colegioId: string | number,
  cursoId: string | number
) => {
  try {
    const response = await api.delete(`/colegiocurso/${colegioId}/${cursoId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    const errorData = axiosError.response?.data || {
      message: "Error al eliminar el curso",
    };
    const errorMessage =
      typeof errorData === "string"
        ? errorData
        : errorData.message || "Error al eliminar el curso";
    throw new Error(errorMessage);
  }
};
