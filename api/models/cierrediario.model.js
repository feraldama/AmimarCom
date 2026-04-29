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

  // Paginated list of distinct dates with aggregations. Optional date range filter.
  getDatesPaginated: async (
    page,
    limit,
    fechaDesde,
    fechaHasta,
    sortBy = "Fecha",
    sortOrder = "desc"
  ) => {
    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      filters.push(`"CierreDiarioFecha" >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      filters.push(`"CierreDiarioFecha" <= $${params.length}::date`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Whitelist allowed sort columns; everything else falls back to Fecha.
    const sortColumns = {
      Fecha: `"CierreDiarioFecha"`,
      CantCajas: `COUNT(*)`,
      Total: `COALESCE(SUM("CierreDiarioCajaMonto"), 0)`,
    };
    const orderExpr = sortColumns[sortBy] || sortColumns.Fecha;
    const orderDir = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT
        "CierreDiarioFecha"::text AS "Fecha",
        COUNT(*)::int AS "CantCajas",
        COALESCE(SUM("CierreDiarioCajaMonto"), 0)::numeric AS "Total"
      FROM "cierrediario"
      ${where}
      GROUP BY "CierreDiarioFecha"
      ORDER BY ${orderExpr} ${orderDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const data = await db.query(dataQuery, dataParams);

    const countQuery = `
      SELECT COUNT(DISTINCT "CierreDiarioFecha")::int AS total
      FROM "cierrediario"
      ${where}
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
