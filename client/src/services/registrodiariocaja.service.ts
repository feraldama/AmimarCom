import api from "./api";
import type { AxiosError } from "axios";

export const aperturaCierreCaja = async (data: {
  apertura: 0 | 1;
  CajaId: string | number;
  Monto: number;
  UsuarioId?: string | number;
  RegistroDiarioCajaPendiente1?: number;
  RegistroDiarioCajaPendiente2?: number;
  RegistroDiarioCajaPendiente3?: number;
  RegistroDiarioCajaPendiente4?: number;
}) => {
  try {
    const response = await api.post(
      "/registrodiariocaja/apertura-cierre",
      data,
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error en apertura/cierre de caja",
      }
    );
  }
};

// Último cierre de una caja (monto contado en el arqueo y fecha), o
// cierre: null si la caja nunca se cerró. Es el monto con el que se apertura.
export const getUltimoCierrePorCaja = async (
  cajaId: string | number,
): Promise<{ cierre: { monto: number; fecha: string } | null }> => {
  try {
    const response = await api.get(`/registrodiariocaja/ultimo-cierre`, {
      params: { cajaId },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al consultar el último cierre de la caja",
      }
    );
  }
};

export interface SaldoCajaAbierta {
  cajaId: number;
  apertura: number;
  ingresos: number;
  egresos: number;
  saldoTeorico: number;
}

// Saldo teórico de la caja abierta del usuario logueado (apertura + ingresos -
// egresos desde la apertura), para el sobrante/faltante en vivo del cierre.
export const getSaldoCajaAbierta = async (): Promise<SaldoCajaAbierta> => {
  try {
    const response = await api.get(`/registrodiariocaja/saldo-caja-abierta`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al consultar el saldo de la caja",
      }
    );
  }
};

// Último turno cerrado por el usuario logueado en la caja: ids de apertura y
// cierre y todos los registros de la caja entre ambos (para el ticket).
export const getTurnoCierre = async <T>(
  cajaId: string | number,
): Promise<{ aperturaId: number; cierreId: number; registros: T[] }> => {
  try {
    const response = await api.get(`/registrodiariocaja/turno-cierre`, {
      params: { cajaId },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener los registros del cierre",
      }
    );
  }
};

export const getEstadoAperturaPorUsuario = async (
  usuarioId: string | number,
) => {
  try {
    const response = await api.get(`/registrodiariocaja/estado-apertura`, {
      params: { usuarioId },
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al consultar estado de apertura de caja",
      }
    );
  }
};
