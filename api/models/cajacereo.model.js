const db = require("../config/db");

// Cajas que se cerean el 1 de cada mes: las de colegios (tipo 4) y las de
// anticipos (por nombre, así las nuevas entran solas).
const FILTRO_CAJAS = `"CajaTipoId" = 4 OR "CajaDescripcion" ILIKE '%ANTICIPO%'`;

const CajaCereo = {
  // Pone en 0 el CajaMonto de las cajas a cerear y registra en `cajacereo` el
  // saldo que tenía cada una. `mes` es el primer día del mes (YYYY-MM-01).
  // Atómico y sin duplicar: con un lock advisory y la marca del mes en la
  // tabla, si ese mes ya se cereó no hace nada.
  // Con `simular` devuelve lo que haría y deshace todo.
  // Devuelve { estado: "ok" | "existe" | "simulado", mes, cajas }.
  cerearMes: async (mes, { simular = false } = {}) => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('cajacereo'))`);

      const existentes = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM "cajacereo" WHERE "CajaCereoMes" = $1::date`,
          [mes]
        )
      ).rows[0].count;
      if (existentes > 0) {
        await client.query("ROLLBACK");
        return { estado: "existe", mes, cajas: [] };
      }

      // Bloquea las filas para que un movimiento simultáneo no se pise
      const cajas = (
        await client.query(
          `SELECT "CajaId", TRIM("CajaDescripcion") AS "CajaDescripcion",
                  "CajaMonto"::numeric AS "CajaMonto"
           FROM "caja"
           WHERE ${FILTRO_CAJAS}
           ORDER BY "CajaId"
           FOR UPDATE`
        )
      ).rows;

      if (cajas.length > 0) {
        await client.query(
          `INSERT INTO "cajacereo" ("CajaCereoMes", "CajaId", "CajaCereoMontoAnterior")
           SELECT $1::date, "CajaId", "CajaMonto" FROM "caja"
           WHERE "CajaId" = ANY($2::int[])`,
          [mes, cajas.map((c) => c.CajaId)]
        );
        await client.query(
          `UPDATE "caja" SET "CajaMonto" = 0 WHERE "CajaId" = ANY($1::int[])`,
          [cajas.map((c) => c.CajaId)]
        );
      }

      await client.query(simular ? "ROLLBACK" : "COMMIT");
      return { estado: simular ? "simulado" : "ok", mes, cajas };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = CajaCereo;
