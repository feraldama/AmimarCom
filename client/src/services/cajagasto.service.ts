import api from "./api";
import type { AxiosError } from "axios";

export interface CajaGasto {
  CajaGastoId: string | number;
  CajaId: string | number;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  [key: string]: unknown;
}

export const getCajaGastos = async () => {
  try {
    const response = await api.get("/cajagasto");
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gastos de caja",
      }
    );
  }
};

export const getCajaGastoById = async (id: string | number) => {
  try {
    const response = await api.get(`/cajagasto/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al obtener gasto de caja" }
    );
  }
};

export const getCajaGastosByCajaId = async (cajaId: string | number) => {
  try {
    const response = await api.get(`/cajagasto/caja/${cajaId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gastos de la caja",
      }
    );
  }
};

export const getCajaGastosByTipoGastoAndGrupo = async (
  tipoGastoId: string | number,
  tipoGastoGrupoId: string | number
) => {
  try {
    const response = await api.get(
      `/cajagasto/tipo/${tipoGastoId}/grupo/${tipoGastoGrupoId}`
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gastos por tipo y grupo",
      }
    );
  }
};

export const createCajaGasto = async (data: Omit<CajaGasto, "CajaGastoId">) => {
  try {
    const response = await api.post("/cajagasto", data);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear gasto de caja" }
    );
  }
};

export const updateCajaGasto = async (
  id: string | number,
  data: Partial<CajaGasto>
) => {
  try {
    const response = await api.put(`/cajagasto/${id}`, data);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar gasto de caja",
      }
    );
  }
};

export const deleteCajaGasto = async (id: string | number) => {
  try {
    const response = await api.delete(`/cajagasto/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar gasto de caja",
      }
    );
  }
};
