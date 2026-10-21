import api from "./api";
import type { AxiosError } from "axios";

// Diferencia de un cierre de caja. Diferencia = teórico - contado:
// > 0 faltante, < 0 sobrante. Los montos llegan como string (numeric de pg).
export interface CierreDiferencia {
  Id: number;
  Fecha: string; // YYYY-MM-DD HH24:MI
  CajaId: number;
  CajaDescripcion: string;
  UsuarioId: string;
  UsuarioNombre: string;
  Apertura: string | number;
  Ingresos: string | number;
  Egresos: string | number;
  Teorico: string | number;
  Contado: string | number;
  Diferencia: string | number;
  Observacion: string | null;
  Revisado: boolean;
  RevisadoPor: string | null;
  RevisadoFecha: string | null;
  // Movimientos de este turno corregidos/eliminados después del cierre
  CantCorrecciones: number;
}

export interface MovimientoTurno {
  Id: number;
  Fecha: string;
  Tipo: "INGRESO" | "EGRESO";
  Grupo: string | null;
  Detalle: string | null;
  Monto: string | number;
  UsuarioId: string;
  EsTurno: boolean; // fila de apertura/cierre
  AgregadoDespues: boolean; // agregado a este cierre después de cerrar
  // MISMO_MONTO: igual a la diferencia; MITAD: la diferencia es el doble
  Coincidencia: "MISMO_MONTO" | "MITAD" | null;
}

export interface MovimientoOtraCaja {
  Id: number;
  Fecha: string;
  CajaDescripcion: string;
  Tipo: "INGRESO" | "EGRESO";
  Grupo: string | null;
  Detalle: string | null;
  Monto: string | number;
  UsuarioId: string;
}

// Auditoría de un movimiento del turno corregido o eliminado después del cierre
export interface CorreccionTurno {
  Id: number;
  Fecha: string; // YYYY-MM-DD HH24:MI
  MovimientoId: number;
  Tipo: "CORRECCION" | "ELIMINACION" | "ALTA";
  MontoAnterior: string | number;
  MontoNuevo: string | number | null; // null en una eliminación
  DetalleAnterior: string | null;
  DiferenciaAnterior: string | number | null;
  DiferenciaNueva: string | number | null;
  Motivo: string;
  UsuarioId: string;
  UsuarioNombre: string;
}

export interface CierreDiferenciaDetalle extends CierreDiferencia {
  movimientos: MovimientoTurno[];
  otrasCajas: MovimientoOtraCaja[];
  correcciones: CorreccionTurno[];
}

export interface TotalesDiferencias {
  Cantidad: number;
  CantFaltantes: number;
  CantSobrantes: number;
  TotalFaltantes: string | number;
  TotalSobrantes: string | number;
  CantPendientes: number;
}

export interface FiltrosDiferencias {
  fechaDesde?: string;
  fechaHasta?: string;
  cajaId?: string;
  tipo?: "" | "con" | "faltante" | "sobrante";
  revisado?: "" | "S" | "N";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ListadoResponse {
  data: CierreDiferencia[];
  totales: TotalesDiferencias;
  pagination: { totalItems: number; totalPages: number; itemsPerPage: number };
}

const errorDe = (error: unknown, porDefecto: string) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data || { message: porDefecto };
};

export const getDiferencias = async (
  page: number,
  limit: number,
  filtros: FiltrosDiferencias
): Promise<ListadoResponse> => {
  try {
    const params: Record<string, string | number> = { page, limit };
    for (const [k, v] of Object.entries(filtros)) if (v) params[k] = v;
    const response = await api.get<ListadoResponse>("/cierrediferencias", { params });
    return response.data;
  } catch (error) {
    throw errorDe(error, "Error al cargar las diferencias");
  }
};

export const getDiferenciaDetalle = async (
  id: number
): Promise<CierreDiferenciaDetalle> => {
  try {
    const response = await api.get<CierreDiferenciaDetalle>(`/cierrediferencias/${id}`);
    return response.data;
  } catch (error) {
    throw errorDe(error, "Error al cargar el detalle");
  }
};

// Agrega a un cierre un movimiento que faltó cargar: queda en ese turno (no en
// el turno en curso) y se recalcula la diferencia. Devuelve el detalle nuevo.
export const agregarMovimientoACierre = async (
  id: number,
  datos: {
    TipoGastoId: number;
    TipoGastoGrupoId: number;
    RegistroDiarioCajaMonto: number;
    RegistroDiarioCajaDetalle: string;
    Motivo: string;
  }
): Promise<{ message: string; data: { detalle: CierreDiferenciaDetalle } }> => {
  try {
    const response = await api.post(`/cierrediferencias/${id}/movimientos`, datos);
    return response.data;
  } catch (error) {
    throw errorDe(error, "Error al agregar el movimiento");
  }
};

export const updateDiferenciaRevision = async (
  id: number,
  observacion: string,
  revisado: boolean
): Promise<CierreDiferenciaDetalle> => {
  try {
    const response = await api.put<CierreDiferenciaDetalle>(`/cierrediferencias/${id}`, {
      observacion,
      revisado,
    });
    return response.data;
  } catch (error) {
    throw errorDe(error, "Error al guardar la revisión");
  }
};
