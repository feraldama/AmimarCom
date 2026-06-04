/**
 * Elimina la columna "JSICobroCod" de la tabla "jsicobro".
 *
 * La columna quedó sin uso (la lógica de código JSI fue removida del frontend
 * y del modelo). Mientras existía con restricción NOT NULL provocaba un error
 * 400 al crear cobros, porque el INSERT ya no le envía valor.
 *
 * Es idempotente: usa DROP COLUMN IF EXISTS, así que correrlo más de una vez
 * no falla.
 *
 * Uso (desde la carpeta api): node scripts/drop-jsicobrocod-column.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../config/db");

async function main() {
  // Verificar si la columna existe antes de actuar (solo para informar)
  const checkRes = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_name = 'jsicobro'
        AND column_name = 'JSICobroCod'`,
  );

  if (checkRes.rows.length === 0) {
    console.log('La columna "JSICobroCod" no existe. Nada que hacer.');
    await db.end();
    return;
  }

  await db.query('ALTER TABLE "jsicobro" DROP COLUMN IF EXISTS "JSICobroCod"');
  console.log('Columna "JSICobroCod" eliminada de la tabla "jsicobro".');

  await db.end();
}

main().catch((err) => {
  console.error("Error al eliminar la columna JSICobroCod:", err);
  process.exit(1);
});
