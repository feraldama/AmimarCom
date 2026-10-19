const db = require("../config/db");

// Día de negocio en Paraguay, sin importar el huso del servidor ni de la DB.
const HOY_SQL = `(now() AT TIME ZONE 'America/Asuncion')::date`;

const CierreDiario = {
  // Registra el snapshot del día: una fila por caja con su CajaMonto actual.
  // La fecha es la del día en Paraguay, calculada en la DB para no depender
  // del huso del servidor (con UTC, después de las 21:00 quedaba fechado al
  // día siguiente). Corre en una transacción con un lock advisory, así dos
  // pedidos simultáneos no pueden duplicar el cierre.
  // Si hay cajas internas abiertas (su CajaMonto es el saldo teórico del
  // turno en curso, no lo contado) no registra nada salvo que venga `forzar`.
  // Devuelve { estado: "ok" | "existe" | "abiertas", fecha, ... }.
  registrarSnapshot: async ({ forzar = false } = {}) => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('cierrediario'))`);
      const fecha = (await client.query(`SELECT ${HOY_SQL}::text AS fecha`))
        .rows[0].fecha;

      const existing = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM "cierrediario" WHERE "CierreDiarioFecha" = $1::date`,
          [fecha]
        )
      ).rows[0].count;
      if (existing > 0) {
        await client.query("ROLLBACK");
        return { estado: "existe", fecha, existing };
      }

      const abiertas = await CierreDiario.getCajasAbiertas(client);
      if (abiertas.length > 0 && !forzar) {
        await client.query("ROLLBACK");
        return { estado: "abiertas", fecha, abiertas };
      }

      const result = await client.query(
        `INSERT INTO "cierrediario" ("CierreDiarioFecha", "CajaId", "CierreDiarioCajaMonto")
         SELECT $1::date, "CajaId", "CajaMonto" FROM "caja"`,
        [fecha]
      );
      await client.query("COMMIT");
      return { estado: "ok", fecha, inserted: result.rowCount, abiertas };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Cajas internas (tipo 1) con un turno abierto: su última apertura es
  // posterior a su último cierre. Incluye el usuario que la abrió.
  getCajasAbiertas: async (q = db) => {
    const result = await q.query(
      `SELECT c."CajaId", c."CajaDescripcion", a."UsuarioId"
       FROM "caja" c
       JOIN LATERAL (
         SELECT "RegistroDiarioCajaId", "UsuarioId" FROM "registrodiariocaja"
         WHERE "CajaId" = c."CajaId" AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2
         ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1
       ) a ON TRUE
       WHERE c."CajaTipoId" = 1
         AND a."RegistroDiarioCajaId" > COALESCE((
           SELECT MAX("RegistroDiarioCajaId") FROM "registrodiariocaja"
           WHERE "CajaId" = c."CajaId" AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2
         ), 0)
       ORDER BY c."CajaDescripcion"`
    );
    return result.rows;
  },

  // Paginated list of distinct dates with aggregations. Filtros opcionales de
  // rango de fechas y de caja. Con `cajaId` cada fecha agrupa una sola fila, o
  // sea que "Total" pasa a ser el monto de esa caja en esa fecha.
  getDatesPaginated: async (
    page,
    limit,
    fechaDesde,
    fechaHasta,
    sortBy = "Fecha",
    sortOrder = "desc",
    cajaId
  ) => {
    const offset = (page - 1) * limit;
    // El filtro de caja se aplica al agrupar (dentro del CTE) y el de fechas
    // recién después, para que la variación se calcule siempre contra el
    // cierre inmediatamente anterior de esa caja aunque quede fuera del rango.
    const cajaFilters = [];
    const fechaFilters = [];
    const params = [];
    if (cajaId) {
      params.push(cajaId);
      cajaFilters.push(`"CajaId" = $${params.length}::int`);
    }
    if (fechaDesde) {
      params.push(fechaDesde);
      fechaFilters.push(`"CierreDiarioFecha" >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      fechaFilters.push(`"CierreDiarioFecha" <= $${params.length}::date`);
    }
    const toWhere = (arr) => (arr.length ? `WHERE ${arr.join(" AND ")}` : "");
    const cajaWhere = toWhere(cajaFilters);
    const fechaWhere = toWhere(fechaFilters);
    const countWhere = toWhere([...cajaFilters, ...fechaFilters]);

    // Whitelist allowed sort columns; everything else falls back to Fecha.
    // Son los nombres que expone el CTE, no las expresiones agregadas.
    const sortColumns = {
      Fecha: `"CierreDiarioFecha"`,
      CantCajas: `"CantCajas"`,
      Total: `"Total"`,
      Variacion: `"Variacion"`,
    };
    const orderExpr = sortColumns[sortBy] || sortColumns.Fecha;
    const orderDir = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";

    const dataParams = [...params, limit, offset];
    // La variación es NULL en el cierre más viejo de la serie (no hay anterior
    // con qué comparar); NULLS LAST la deja al final al ordenar por esa columna.
    const dataQuery = `
      WITH "porFecha" AS (
        SELECT
          "CierreDiarioFecha",
          COUNT(*)::int AS "CantCajas",
          COALESCE(SUM("CierreDiarioCajaMonto"), 0)::numeric AS "Total"
        FROM "cierrediario"
        ${cajaWhere}
        GROUP BY "CierreDiarioFecha"
      ),
      "conVariacion" AS (
        SELECT
          "CierreDiarioFecha",
          "CantCajas",
          "Total",
          "Total" - LAG("Total") OVER (ORDER BY "CierreDiarioFecha")
            AS "Variacion"
        FROM "porFecha"
      )
      SELECT
        "CierreDiarioFecha"::text AS "Fecha",
        "CantCajas",
        "Total",
        "Variacion"
      FROM "conVariacion"
      ${fechaWhere}
      ORDER BY ${orderExpr} ${orderDir} NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const data = await db.query(dataQuery, dataParams);

    const countQuery = `
      SELECT COUNT(DISTINCT "CierreDiarioFecha")::int AS total
      FROM "cierrediario"
      ${countWhere}
    `;
    const count = await db.query(countQuery, params);

    const totalItems = count.rows[0]?.total || 0;
    return {
      data: data.rows,
      pagination: {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        itemsPerPage: data.rows.length,
      },
    };
  },

  // Detail rows for a given date — joins caja for the description.
  getDetailByFecha: async (fecha) => {
    const result = await db.query(
      `SELECT
         cd."CierreDiarioId",
         cd."CajaId",
         c."CajaDescripcion",
         cd."CierreDiarioCajaMonto"::numeric AS "CierreDiarioCajaMonto"
       FROM "cierrediario" cd
       JOIN "caja" c ON c."CajaId" = cd."CajaId"
       WHERE cd."CierreDiarioFecha" = $1::date
       ORDER BY c."CajaDescripcion"`,
      [fecha]
    );
    return result.rows;
  },
};

module.exports = CierreDiario;
