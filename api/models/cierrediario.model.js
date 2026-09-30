const db = require("../config/db");

const CierreDiario = {
  // Returns the count of snapshots already recorded for the given date.
  countByFecha: async (fecha) => {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM "cierrediario" WHERE "CierreDiarioFecha" = $1::date`,
      [fecha]
    );
    return result.rows[0].count;
  },

  // INSERT one row per caja with the caja's current monto, dated `fecha`.
  // Returns the number of rows inserted.
  createSnapshot: async (fecha) => {
    const result = await db.query(
      `INSERT INTO "cierrediario" ("CierreDiarioFecha", "CajaId", "CierreDiarioCajaMonto")
       SELECT $1::date, "CajaId", "CajaMonto" FROM "caja"`,
      [fecha]
    );
    return result.rowCount;
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
