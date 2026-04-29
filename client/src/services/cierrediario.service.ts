import api from "./api";
import type { AxiosError } from "axios";

interface SnapshotResponse {
  message: string;
  fecha: string;
  inserted?: number;
  existing?: number;
}

export interface CierreDiarioDateRow {
  Fecha: string;
  CantCajas: number;
  Total: string | number;
}

export interface CierreDiarioDetailRow {
  CierreDiarioId: number;
  CajaId: number;
  CajaDescripcion: string;
  CierreDiarioCajaMonto: string | number;
}

interface HistorialResponse {
  data: CierreDiarioDateRow[];
  pagination: {
    totalItems: number;
    totalPages: number;
    itemsPerPage: number;
  };
}

interface DetailResponse {
  fecha: string;
  data: CierreDiarioDetailRow[];
}

export const createCierreDiarioSnapshot = async (): Promise<SnapshotResponse> => {
  try {
    const response = await api.post<SnapshotResponse>("/cierrediario/snapshot");
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<SnapshotResponse>;
    throw axiosError.response?.data || { message: "Error desconocido" };
  }
};

export const getCierreDiarioHistorial = async (
  page = 1,
  limit = 10,
  fechaDesde?: string,
  fechaHasta?: string,
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): Promise<HistorialResponse> => {
  try {
    const params: Record<string, string | number> = { page, limit };
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;
    if (sortBy) params.sortBy = sortBy;
    if (sortOrder) params.sortOrder = sortOrder;
    const response = await api.get<HistorialResponse>("/cierrediario", {
      params,
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al cargar historial" };
  }
};

export const getCierreDiarioDetail = async (
  fecha: string
): Promise<DetailResponse> => {
  try {
    const response = await api.get<DetailResponse>(
      `/cierrediario/detail/${fecha}`
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw axiosError.response?.data || { message: "Error al cargar detalle" };
  }
};
