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
    sortOrder = "DESC",
    filters = {}
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

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, divisaId, divisaMovimientoTipo } =
      filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`dm."DivisaMovimientoFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`dm."DivisaMovimientoFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`dm."CajaId" = $${params.length}`);
    }
    if (divisaId) {
      params.push(divisaId);
      conditions.push(`dm."DivisaId" = $${params.length}`);
    }
    if (divisaMovimientoTipo) {
      params.push(divisaMovimientoTipo);
      conditions.push(`dm."DivisaMovimientoTipo" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT dm.*,
        c."CajaDescripcion",
        d."DivisaNombre",
        u."UsuarioNombre"
      FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      ${where}
      ORDER BY dm."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "divisamovimiento" dm ${where}`,
      params
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
    sortOrder = "DESC",
    filters = {}
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

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        dm."DivisaMovimientoTipo" ILIKE $1
        OR CAST(dm."DivisaMovimientoId" AS TEXT) ILIKE $1
        OR CAST(dm."CajaId" AS TEXT) ILIKE $1
        OR CAST(dm."DivisaId" AS TEXT) ILIKE $1
        OR CAST(dm."DivisaMovimientoCambio" AS TEXT) ILIKE $1
        OR CAST(dm."DivisaMovimientoCantidad" AS TEXT) ILIKE $1
        OR CAST(dm."DivisaMovimientoMonto" AS TEXT) ILIKE $1
        OR CAST(dm."UsuarioId" AS TEXT) ILIKE $1
        OR c."CajaDescripcion" ILIKE $1
        OR d."DivisaNombre" ILIKE $1
        OR u."UsuarioNombre" ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, divisaId, divisaMovimientoTipo } =
      filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`dm."DivisaMovimientoFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`dm."DivisaMovimientoFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`dm."CajaId" = $${params.length}`);
    }
    if (divisaId) {
      params.push(divisaId);
      conditions.push(`dm."DivisaId" = $${params.length}`);
    }
    if (divisaMovimientoTipo) {
      params.push(divisaMovimientoTipo);
      conditions.push(`dm."DivisaMovimientoTipo" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT dm.*,
        c."CajaDescripcion",
        d."DivisaNombre",
        u."UsuarioNombre"
      FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      ${where}
      ORDER BY dm."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "divisamovimiento" dm
      LEFT JOIN "caja" c ON dm."CajaId" = c."CajaId"
      LEFT JOIN "divisa" d ON dm."DivisaId" = d."DivisaId"
      LEFT JOIN "usuario" u ON dm."UsuarioId" = u."UsuarioId"
      ${where}
    `;

    const countResult = await db.query(countQuery, params);

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

  // cajaIds: lista opcional de CajaId a incluir (vacía = todas)
  getReporteHistorial: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    let filtroCajas = "";
    if (Array.isArray(cajaIds) && cajaIds.length > 0) {
      params.push(cajaIds.map(Number));
      filtroCajas = `AND dm."CajaId" = ANY($${params.length}::int[])`;
    }
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
        ${filtroCajas}
      ORDER BY dm."DivisaMovimientoFecha" ASC, dm."DivisaMovimientoId" ASC`,
      params
    );
    return result.rows;
  },

  // cajaIds: lista opcional de CajaId a incluir (vacía = todas)
  getReporteResumen: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    let filtroCajas = "";
    if (Array.isArray(cajaIds) && cajaIds.length > 0) {
      params.push(cajaIds.map(Number));
      filtroCajas = `AND dm."CajaId" = ANY($${params.length}::int[])`;
    }
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
        ${filtroCajas}
      GROUP BY d."DivisaId", d."DivisaNombre"
      ORDER BY d."DivisaNombre"`,
      params
    );
    return result.rows;
  },
};

module.exports = DivisaMovimiento;
