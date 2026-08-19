import api from "./api";
import type { AxiosError } from "axios";

export interface ColegioCobranzaFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  cajaId?: string | number;
  colegioId?: string | number;
}

const buildFiltrosParams = (filtros?: ColegioCobranzaFiltros) => {
  const params: { [key: string]: string | number } = {};
  if (!filtros) return params;
  if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
  if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
  if (filtros.cajaId) params.cajaId = filtros.cajaId;
  if (filtros.colegioId) params.colegioId = filtros.colegioId;
  return params;
};

export const getColegioCobranzas = async (
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  filtros?: ColegioCobranzaFiltros
) => {
  const params: { [key: string]: string | number | undefined } = {
    page,
    limit,
    ...buildFiltrosParams(filtros),
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
  sortOrder?: "asc" | "desc",
  filtros?: ColegioCobranzaFiltros
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

export const getReporteCobranzaColegio = async (
  fechaInicio: string,
  fechaFin: string,
  colegioId: string | number
) => {
  try {
    const response = await api.get("/colegiocobranza/reporte", {
      params: { fechaInicio, fechaFin, colegioId },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de cobranza del colegio",
      }
    );
  }
};
