/**
 * Agrega las columnas "MontoCajaOrigen" y "MontoCajaDestino" a la tabla
 * "pagoadmin".
 *
 * Estas columnas guardan el saldo en que quedó cada caja (origen y destino)
 * en el momento exacto en que se realizó el pago admin. Antes de este cambio
 * el historial mostraba el saldo ACTUAL de la caja, por lo que al hacer un
 * nuevo movimiento se "reescribía" visualmente todo el historial. Con estas
 * columnas el historial queda congelado al valor del momento de la operación.
 *
 * Es idempotente: usa ADD COLUMN IF NOT EXISTS, así que correrlo más de una
 * vez no falla. No hace backfill de los registros antiguos (no es posible
 * reconstruir el saldo histórico exacto), esos quedan en NULL.
 *
 * Uso (desde la carpeta api): node scripts/add-pagoadmin-montos-columns.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../config/db");

async function main() {
  await db.query(
    'ALTER TABLE "pagoadmin" ADD COLUMN IF NOT EXISTS "MontoCajaOrigen" NUMERIC'
  );
  await db.query(
    'ALTER TABLE "pagoadmin" ADD COLUMN IF NOT EXISTS "MontoCajaDestino" NUMERIC'
  );

  console.log(
    'Columnas "MontoCajaOrigen" y "MontoCajaDestino" agregadas a la tabla "pagoadmin".'
  );

  await db.end();
}

main().catch((err) => {
  console.error("Error al agregar las columnas a pagoadmin:", err);
  process.exit(1);
});
