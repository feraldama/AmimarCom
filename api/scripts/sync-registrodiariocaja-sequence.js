/**
 * Corrige error 23505 (PK duplicada) cuando la secuencia de
 * "RegistroDiarioCajaId" quedó por debajo del MAX(id) (importaciones, restores, etc.).
 *
 * Uso (desde la carpeta api): node scripts/sync-registrodiariocaja-sequence.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const db = require("../config/db");

async function main() {
  const maxRes = await db.query(
    `SELECT COALESCE(MAX("RegistroDiarioCajaId"), 0) AS m FROM "registrodiariocaja"`,
  );
  const maxId = Number(maxRes.rows[0].m);

  let seqName = null;
  for (const tableArg of [
    "registrodiariocaja",
    '"registrodiariocaja"',
    "public.registrodiariocaja",
  ]) {
    const r = await db.query(
      `SELECT pg_get_serial_sequence($1, 'RegistroDiarioCajaId') AS s`,
      [tableArg],
    );
    if (r.rows[0]?.s) {
      seqName = r.rows[0].s;
      break;
    }
  }

  if (seqName) {
    await db.query(`SELECT setval($1::regclass, $2::bigint, true)`, [
      seqName,
      Math.max(maxId, 1),
    ]);
    console.log(
      `Secuencia ${seqName} ajustada: siguiente id será > ${Math.max(maxId, 1)}`,
    );
  } else {
    const next = maxId + 1;
    await db.query(
      `ALTER TABLE "registrodiariocaja" ALTER COLUMN "RegistroDiarioCajaId" RESTART WITH ${next}`,
    );
    console.log(
      `Columna IDENTITY: RESTART WITH ${next} (siguiente insert usará ${next})`,
    );
  }

  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
