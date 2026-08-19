/** Fila de registrodiariocaja con sus descripciones, como la devuelve la API. */
export interface RegistroCaja {
  RegistroDiarioCajaId: number;
  CajaId: number;
  RegistroDiarioCajaFecha: string;
  RegistroDiarioCajaMonto: number;
  RegistroDiarioCajaDetalle: string;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  UsuarioId: string;
  UsuarioNombre?: string;
  CajaDescripcion: string;
  TipoGastoDescripcion: string;
  TipoGastoGrupoDescripcion: string;
}
