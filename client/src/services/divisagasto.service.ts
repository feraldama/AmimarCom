import api from "./api";
import type { AxiosError } from "axios";

export const getDivisaGastos = async () => {
  try {
    const response = await api.get("/divisagasto");
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gastos de divisa",
      }
    );
  }
};

export const getDivisaGastoById = async (id: string | number) => {
  try {
    const response = await api.get(`/divisagasto/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gasto de divisa",
      }
    );
  }
};

export const getDivisaGastosByDivisaId = async (divisaId: string | number) => {
  try {
    const response = await api.get(`/divisagasto/divisa/${divisaId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener gastos de divisa",
      }
    );
  }
};

export const createDivisaGasto = async (
  divisaGastoData: Record<string, unknown>
) => {
  try {
    const response = await api.post("/divisagasto", divisaGastoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || { message: "Error al crear gasto de divisa" }
    );
  }
};

export const updateDivisaGasto = async (
  id: string | number,
  divisaGastoData: Record<string, unknown>
) => {
  try {
    const response = await api.put(`/divisagasto/${id}`, divisaGastoData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al actualizar gasto de divisa",
      }
    );
  }
};

export const deleteDivisaGasto = async (id: string | number) => {
  try {
    const response = await api.delete(`/divisagasto/${id}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al eliminar gasto de divisa",
      }
    );
  }
};
