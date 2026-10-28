// Grupos Western "3 WESTERN - USD." (pagos: TipoGastoId 1, grupo 20; envíos:
// TipoGastoId 2, grupo 28): el monto está en DÓLARES y la caja del cajero (en
// Gs.) no se mueve, así que no cuentan en el teórico en Gs. del turno (mismo
// criterio que api/utils/gruposUsd.js)
export const esGrupoUsd = (tipoGastoId: number, grupoId: number) =>
  (tipoGastoId === 1 && grupoId === 20) || (tipoGastoId === 2 && grupoId === 28);
