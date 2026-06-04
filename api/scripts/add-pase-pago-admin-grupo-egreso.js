/**
 * Crea el grupo de gasto "PASE PAGO ADMINISTRADOR" del lado EGRESO
 * (TipoGastoId = 1) en la tabla "tipogastogrupo".
 *
 * Del lado INGRESO ya existe (TipoGastoId = 2, TipoGastoGrupoId = 37), pero el
 * egreso de la caja origen en un pago admin no tenía un grupo propio y se
 * estaba registrando con un grupo equivocado ("VENTA AL COMERCIO DÓLAR").
 *
 * Inserta TipoGastoId = 1, TipoGastoGrupoId = 90 (primer ID libre para egresos).
 * Es idempotente: ON CONFLICT DO NOTHING, así que correrlo más de una vez no
 * falla.
 *
 * Uso (desde la carpeta api): node scripts/add-pase-pago-admin-grupo-egreso.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../config/db");

const TIPO_GASTO_ID = 1; // EGRESOS
const TIPO_GASTO_GRUPO_ID = 90; // primer ID libre para TipoGastoId = 1
const DESCRIPCION = "PASE PAGO ADMINISTRADOR";

async function main() {
  await db.query(
    `INSERT INTO "tipogastogrupo" ("TipoGastoId", "TipoGastoGrupoId", "TipoGastoGrupoDescripcion")
     VALUES ($1, $2, $3)
     ON CONFLICT ("TipoGastoId", "TipoGastoGrupoId") DO NOTHING`,
    [TIPO_GASTO_ID, TIPO_GASTO_GRUPO_ID, DESCRIPCION]
  );

  console.log(
    `Grupo "${DESCRIPCION}" (TipoGastoId=${TIPO_GASTO_ID}, TipoGastoGrupoId=${TIPO_GASTO_GRUPO_ID}) listo.`
  );

  await db.end();
}

main().catch((err) => {
  console.error("Error al crear el grupo de egreso PASE PAGO ADMINISTRADOR:", err);
  process.exit(1);
});
