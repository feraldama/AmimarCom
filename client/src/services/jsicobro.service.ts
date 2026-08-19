import api from "./api";
import type { AxiosError } from "axios";

export interface JSICobro {
  id?: string | number;
  JSICobroId?: number;
  CajaId?: number;
  JSICobroFecha?: string;
  ClienteId?: number;
  JSICobroMonto?: number;
  JSICobroUsuarioId?: number;
  CajaDescripcion?: string;
  ClienteNombre?: string;
  ClienteApellido?: string;
}

export interface JSICobroFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  cajaId?: string | number;
  clienteId?: string | number;
}

const buildFiltrosParams = (filtros?: JSICobroFiltros) => {
  const params: { [key: string]: string | number } = {};
  if (!filtros) return params;
  if (filtros.fechaDesde) params.fechaDesde = filtros.fechaDesde;
  if (filtros.fechaHasta) params.fechaHasta = filtros.fechaHasta;
  if (filtros.cajaId) params.cajaId = filtros.cajaId;
  if (filtros.clienteId) params.clienteId = filtros.clienteId;
  return params;
};

export const getJSICobros = async (
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  filtros?: JSICobroFiltros
) => {
  const params: { [key: string]: string | number | undefined } = {
    page,
    limit,
    ...buildFiltrosParams(filtros),
  };
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  try {
    const response = await api.get("/jsicobro", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener cobros de JSI",
      }
    );
  }
};

export const getJSICobroById = async (id: string | number) => {
  try {
    const response = await api.get(`/jsicobro/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener cobro de JSI",
      }
    );
  }
};

export const createJSICobro = async (jsicobroData: JSICobro) => {
  try {
    const response = await api.post("/jsicobro", jsicobroData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al crear cobro de JSI",
      }
    );
  }
};

export const updateJSICobro = async (
  id: string | number,
  jsicobroData: JSICobro
) => {
  try {
    const response = await api.put(`/jsicobro/${id}`, jsicobroData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar cobro de JSI",
      }
    );
  }
};

export const deleteJSICobro = async (id: string | number) => {
  try {
    const response = await api.delete(`/jsicobro/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar cobro de JSI",
      }
    );
  }
};

export const searchJSICobros = async (
  searchTerm: string,
  page = 1,
  limit = 10,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  filtros?: JSICobroFiltros
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
    const response = await api.get("/jsicobro/search", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar cobros de JSI",
      }
    );
  }
};

export const getReporteJSICobros = async (
  fechaInicio: string,
  fechaFin: string
) => {
  try {
    const response = await api.get("/jsicobro/reporte", {
      params: { fechaInicio, fechaFin },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el reporte de cobros JSI",
      }
    );
  }
};
