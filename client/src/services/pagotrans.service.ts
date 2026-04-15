import api from "./api";
import type { AxiosError } from "axios";

export interface PagoTrans {
  id?: string | number;
  PagoTransId?: number;
  PagoTransFecha?: string;
  TransporteId?: number;
  PagoTransOrigen?: string;
  PagoTransDestino?: string;
  PagoTransFechaEmbarque?: string;
  PagoTransHora?: string;
  PagoTransAsiento?: string;
  PagoTransMonto?: number;
  CajaId?: number;
  PagoTransNumeroBoleto?: string;
  PagoTransNombreApellido?: string;
  PagoTransCI?: string;
  PagoTransTelefono?: string;
  ClienteId?: number;
  PagoTransUsuarioId?: number;
  PagoTransClienteRUC?: string;
  TransporteNombre?: string;
  CajaDescripcion?: string;
  ClienteNombre?: string;
  ClienteApellido?: string;
}

export const getPagosTrans = async (
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
    const response = await api.get("/pagotrans", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener pagos de transporte",
      }
    );
  }
};

export const getPagoTransById = async (id: string | number) => {
  try {
    const response = await api.get(`/pagotrans/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener pago de transporte",
      }
    );
  }
};

export const createPagoTrans = async (pagoTransData: PagoTrans) => {
  try {
    const response = await api.post("/pagotrans", pagoTransData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al crear pago de transporte",
      }
    );
  }
};

export const updatePagoTrans = async (
  id: string | number,
  pagoTransData: PagoTrans
) => {
  try {
    const response = await api.put(`/pagotrans/${id}`, pagoTransData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar pago de transporte",
      }
    );
  }
};

export const deletePagoTrans = async (id: string | number) => {
  try {
    const response = await api.delete(`/pagotrans/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar pago de transporte",
      }
    );
  }
};

export const searchPagosTrans = async (
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
    const response = await api.get("/pagotrans/search", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al buscar pagos de transporte",
      }
    );
  }
};
