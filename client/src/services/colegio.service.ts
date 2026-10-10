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

// Reporte: estado de resultados (ingresos - retiros - salarios) por colegio.
// colegioId vacío = todos los colegios. Siempre todas las cajas.
export const getReporteEstadoResultados = async (
  fechaInicio: string,
  fechaFin: string,
  colegioId?: string | number
) => {
  try {
    const params: { [key: string]: string | number } = { fechaInicio, fechaFin };
    if (colegioId) params.colegioId = colegioId;
    const response = await api.get("/colegio/estado-resultados", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el estado de resultados de los colegios",
      }
    );
  }
};

// Conceptos del estado de resultados de un colegio (grupos de caja que
// suman a sus ingresos, retiros o salarios)
export type RubroResultado = "INGRESO" | "RETIRO" | "SALARIO";

export interface ConceptoResultadoColegio {
  ColegioId: number;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  ColegioGastoRubro: RubroResultado;
  TipoGastoGrupoDescripcion: string;
}

const errorConceptos = (error: unknown, mensaje: string) => {
  const axiosError = error as AxiosError<{ message?: string }>;
  return new Error(axiosError.response?.data?.message || mensaje);
};

export const getConceptosResultado = async (
  colegioId: string | number
): Promise<ConceptoResultadoColegio[]> => {
  try {
    const response = await api.get(`/colegio/${colegioId}/conceptos-resultado`);
    return response.data;
  } catch (error) {
    throw errorConceptos(error, "Error al obtener los conceptos del colegio");
  }
};

export const addConceptoResultado = async (
  colegioId: string | number,
  concepto: { TipoGastoId: number; TipoGastoGrupoId: number; ColegioGastoRubro: RubroResultado }
): Promise<ConceptoResultadoColegio[]> => {
  try {
    const response = await api.post(`/colegio/${colegioId}/conceptos-resultado`, concepto);
    return response.data;
  } catch (error) {
    throw errorConceptos(error, "Error al agregar el concepto");
  }
};

export const deleteConceptoResultado = async (
  colegioId: string | number,
  tipoGastoId: number,
  tipoGastoGrupoId: number
): Promise<ConceptoResultadoColegio[]> => {
  try {
    const response = await api.delete(
      `/colegio/${colegioId}/conceptos-resultado/${tipoGastoId}/${tipoGastoGrupoId}`
    );
    return response.data;
  } catch (error) {
    throw errorConceptos(error, "Error al quitar el concepto");
  }
};

// Reporte: estado de resultados mes a mes (hasta 12 meses)
export const getReporteEstadoResultadosMensual = async (
  fechaInicio: string,
  fechaFin: string,
  colegioId?: string | number
) => {
  try {
    const params: { [key: string]: string | number } = { fechaInicio, fechaFin };
    if (colegioId) params.colegioId = colegioId;
    const response = await api.get("/colegio/estado-resultados-mensual", { params });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw (
      axiosError.response?.data || {
        message: "Error al obtener el estado de resultados mensual",
      }
    );
  }
};
