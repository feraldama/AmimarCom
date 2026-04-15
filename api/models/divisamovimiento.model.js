const db = require("../config/db");

const DivisaMovimiento = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "divisamovimiento"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT dm.*,
        c."CajaDescripcion",
        d."DivisaNombre",
        u."UsuarioNombre"
      FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      WHERE dm."DivisaMovimientoId" = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "DivisaMovimientoId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "DivisaMovimientoId",
      "CajaId",
      "DivisaMovimientoFecha",
      "DivisaMovimientoTipo",
      "DivisaId",
      "DivisaMovimientoCambio",
      "DivisaMovimientoCantidad",
      "DivisaMovimientoMonto",
      "UsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "DivisaMovimientoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT dm.*,
        c."CajaDescripcion",
        d."DivisaNombre",
        u."UsuarioNombre"
      FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      ORDER BY dm."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "divisamovimiento"'
    );

    return {
      data: result.rows,
      pagination: {
        totalItems: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
        currentPage: Math.floor(offset / limit) + 1,
        itemsPerPage: limit,
      },
    };
  },

  search: async (
    term,
    limit,
    offset,
    sortBy = "DivisaMovimientoId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "DivisaMovimientoId",
      "CajaId",
      "DivisaMovimientoFecha",
      "DivisaMovimientoTipo",
      "DivisaId",
      "DivisaMovimientoCambio",
      "DivisaMovimientoCantidad",
      "DivisaMovimientoMonto",
      "UsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "DivisaMovimientoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT dm.*,
        c."CajaDescripcion",
        d."DivisaNombre",
        u."UsuarioNombre"
      FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      WHERE dm."DivisaMovimientoTipo" ILIKE $1
        OR CAST(dm."DivisaMovimientoId" AS TEXT) ILIKE $2
        OR CAST(dm."CajaId" AS TEXT) ILIKE $3
        OR CAST(dm."DivisaId" AS TEXT) ILIKE $4
        OR CAST(dm."DivisaMovimientoCambio" AS TEXT) ILIKE $5
        OR CAST(dm."DivisaMovimientoCantidad" AS TEXT) ILIKE $6
        OR CAST(dm."DivisaMovimientoMonto" AS TEXT) ILIKE $7
        OR CAST(dm."UsuarioId" AS TEXT) ILIKE $8
        OR c."CajaDescripcion" ILIKE $9
        OR d."DivisaNombre" ILIKE $10
        OR u."UsuarioNombre" ILIKE $11
      ORDER BY dm."${sortField}" ${order}
      LIMIT $12 OFFSET $13
    `;

    const result = await db.query(searchQuery, [
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      limit,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      WHERE dm."DivisaMovimientoTipo" ILIKE $1
        OR CAST(dm."DivisaMovimientoId" AS TEXT) ILIKE $2
        OR CAST(dm."CajaId" AS TEXT) ILIKE $3
        OR CAST(dm."DivisaId" AS TEXT) ILIKE $4
        OR CAST(dm."DivisaMovimientoCambio" AS TEXT) ILIKE $5
        OR CAST(dm."DivisaMovimientoCantidad" AS TEXT) ILIKE $6
        OR CAST(dm."DivisaMovimientoMonto" AS TEXT) ILIKE $7
        OR CAST(dm."UsuarioId" AS TEXT) ILIKE $8
        OR c."CajaDescripcion" ILIKE $9
        OR d."DivisaNombre" ILIKE $10
        OR u."UsuarioNombre" ILIKE $11
    `;

    const countResult = await db.query(countQuery, [
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    ]);

    const total = countResult.rows[0]?.total || 0;

    return {
      data: result.rows,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
        itemsPerPage: limit,
      },
    };
  },

  create: async (divisaMovimientoData) => {
    const query = `
      INSERT INTO "divisamovimiento" (
        "CajaId",
        "DivisaMovimientoFecha",
        "DivisaMovimientoTipo",
        "DivisaId",
        "DivisaMovimientoCambio",
        "DivisaMovimientoCantidad",
        "DivisaMovimientoMonto",
        "UsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING "DivisaMovimientoId"
    `;

    const values = [
      divisaMovimientoData.CajaId,
      divisaMovimientoData.DivisaMovimientoFecha || new Date(),
      divisaMovimientoData.DivisaMovimientoTipo,
      divisaMovimientoData.DivisaId,
      divisaMovimientoData.DivisaMovimientoCambio || 0,
      divisaMovimientoData.DivisaMovimientoCantidad || 0,
      divisaMovimientoData.DivisaMovimientoMonto || 0,
      divisaMovimientoData.UsuarioId,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return DivisaMovimiento.getById(result.rows[0].DivisaMovimientoId);
  },

  update: async (id, divisaMovimientoData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaId",
      "DivisaMovimientoFecha",
      "DivisaMovimientoTipo",
      "DivisaId",
      "DivisaMovimientoCambio",
      "DivisaMovimientoCantidad",
      "DivisaMovimientoMonto",
      "UsuarioId",
    ];

    camposActualizables.forEach((campo) => {
      if (divisaMovimientoData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(divisaMovimientoData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE "divisamovimiento"
      SET ${updateFields.join(", ")}
      WHERE "DivisaMovimientoId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    return DivisaMovimiento.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "divisamovimiento" WHERE "DivisaMovimientoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  // ── REPORTES ──

  getReporteHistorial: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT
        dm.*,
        d."DivisaNombre",
        u."UsuarioNombre",
        c."CajaDescripcion"
      FROM "divisamovimiento" dm
      JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      WHERE dm."DivisaMovimientoFecha"::date >= $1::date
        AND dm."DivisaMovimientoFecha"::date <= $2::date
      ORDER BY dm."DivisaMovimientoFecha" ASC, dm."DivisaMovimientoId" ASC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },

  getReporteResumen: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT
        d."DivisaId",
        d."DivisaNombre",
        COALESCE(SUM(CASE WHEN dm."DivisaMovimientoTipo" = 'C' THEN dm."DivisaMovimientoCantidad" ELSE 0 END), 0) AS "CantCompra",
        COALESCE(SUM(CASE WHEN dm."DivisaMovimientoTipo" = 'C' THEN dm."DivisaMovimientoMonto" ELSE 0 END), 0) AS "MontoCompra",
        COALESCE(SUM(CASE WHEN dm."DivisaMovimientoTipo" = 'V' THEN dm."DivisaMovimientoCantidad" ELSE 0 END), 0) AS "CantVenta",
        COALESCE(SUM(CASE WHEN dm."DivisaMovimientoTipo" = 'V' THEN dm."DivisaMovimientoMonto" ELSE 0 END), 0) AS "MontoVenta",
        COUNT(*) AS "CantOperaciones"
      FROM "divisamovimiento" dm
      JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      WHERE dm."DivisaMovimientoFecha"::date >= $1::date
        AND dm."DivisaMovimientoFecha"::date <= $2::date
      GROUP BY d."DivisaId", d."DivisaNombre"
      ORDER BY d."DivisaNombre"`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },
};

module.exports = DivisaMovimiento;
