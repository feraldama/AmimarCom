// Grupos Western "3 WESTERN - USD." (pagos: TipoGastoId 1, grupo 20; envíos:
// TipoGastoId 2, grupo 28): el monto del registro está en DÓLARES y la caja
// del cajero (en Gs.) no se mueve; los dólares entran/salen por las cajas de
// divisas (ver revertirEnCajas). Por eso no cuentan en el teórico en Gs. del
// turno (diferencia de cierre, saldo a rendir, ticket).
const GRUPOS_USD = [
  [1, 20],
  [2, 28],
];

const esGrupoUsd = (tipoGastoId, grupoId) =>
  GRUPOS_USD.some(([t, g]) => t === Number(tipoGastoId) && g === Number(grupoId));

// Condición SQL "no es un grupo en dólares" para la tabla con alias `alias`
// (ej. 'r.' o '' sin alias)
const sqlNoEsGrupoUsd = (alias = "") =>
  `(${alias}"TipoGastoId", ${alias}"TipoGastoGrupoId") NOT IN (${GRUPOS_USD.map(
    ([t, g]) => `(${t}, ${g})`
  ).join(", ")})`;

module.exports = { GRUPOS_USD, esGrupoUsd, sqlNoEsGrupoUsd };
