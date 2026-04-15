export interface Cliente {
  id?: string | number;
  ClienteId: string | number;
  ClienteRUC: string;
  ClienteNombre: string;
  ClienteApellido: string;
  ClienteDireccion: string;
  ClienteTelefono: string;
  ClienteTipo?: string;
  UsuarioId: string;
  ClienteCodJSI?: string;
  [key: string]: unknown;
}

// Tipo para usar con DataTable que requiere id
export type ClienteWithId = Cliente & {
  id: string | number;
};
