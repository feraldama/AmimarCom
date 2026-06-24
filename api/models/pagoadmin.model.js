const db = require("../config/db");

const PagoAdmin = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "pagoadmin"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "pagoadmin" WHERE "PagoAdminId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "PagoAdminId",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza sortOrder y sortBy para evitar SQL Injection
    const allowedSortFields = [
      "PagoAdminId",
      "PagoAdminFecha",
      "PagoAdminMonto",
      "PagoAdminDetalle",
      "UsuarioId",
      "CajaId",
      "CajaOrigenId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "PagoAdminFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Construye los filtros dinámicamente (rango de fechas + cajas)
    const { fechaDesde, fechaHasta, cajaOrigenId, cajaId } = filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`p."PagoAdminFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`p."PagoAdminFecha"::date <= $${params.length}::date`);
    }
    if (cajaOrigenId) {
      params.push(cajaOrigenId);
      conditions.push(`p."CajaOrigenId" = $${params.length}`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`p."CajaId" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT p.*,
        c."CajaDescripcion",
        co."CajaDescripcion" as "CajaOrigenDescripcion"
      FROM "pagoadmin" p
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "caja" co ON p."CajaOrigenId" = co."CajaId"
      ${where}
      ORDER BY p."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "pagoadmin" p ${where}`,
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
    sortBy = "PagoAdminFecha",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza los campos para evitar SQL Injection
    const allowedSortFields = [
      "PagoAdminId",
      "PagoAdminFecha",
      "PagoAdminMonto",
      "PagoAdminDetalle",
      "UsuarioId",
      "CajaId",
      "CajaOrigenId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "PagoAdminFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        p."PagoAdminDetalle" ILIKE $1
        OR CAST(p."UsuarioId" AS TEXT) ILIKE $1
        OR CAST(p."CajaId" AS TEXT) ILIKE $1
        OR CAST(p."CajaOrigenId" AS TEXT) ILIKE $1
        OR CAST(p."PagoAdminMonto" AS TEXT) ILIKE $1
        OR TO_CHAR(p."PagoAdminFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + cajas)
    const { fechaDesde, fechaHasta, cajaOrigenId, cajaId } = filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`p."PagoAdminFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`p."PagoAdminFecha"::date <= $${params.length}::date`);
    }
    if (cajaOrigenId) {
      params.push(cajaOrigenId);
      conditions.push(`p."CajaOrigenId" = $${params.length}`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`p."CajaId" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT p.*,
        c."CajaDescripcion",
        co."CajaDescripcion" as "CajaOrigenDescripcion"
      FROM "pagoadmin" p
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "caja" co ON p."CajaOrigenId" = co."CajaId"
      ${where}
      ORDER BY p."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "pagoadmin" p
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

  create: async (pagoAdminData) => {
    const query = `
      INSERT INTO "pagoadmin" (
        "CajaOrigenId",
        "CajaId",
        "PagoAdminFecha",
        "PagoAdminDetalle",
        "PagoAdminMonto",
        "UsuarioId",
        "MontoCajaOrigen",
        "MontoCajaDestino"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING "PagoAdminId"
    `;

    const values = [
      pagoAdminData.CajaOrigenId,
      pagoAdminData.CajaId,
      pagoAdminData.PagoAdminFecha || new Date(),
      pagoAdminData.PagoAdminDetalle,
      pagoAdminData.PagoAdminMonto,
      pagoAdminData.UsuarioId,
      pagoAdminData.MontoCajaOrigen ?? null,
      pagoAdminData.MontoCajaDestino ?? null,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return PagoAdmin.getById(result.rows[0].PagoAdminId);
  },

  update: async (id, pagoAdminData) => {
    // Construir la consulta dinámicamente
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaOrigenId",
      "CajaId",
      "PagoAdminFecha",
      "PagoAdminDetalle",
      "PagoAdminMonto",
      "UsuarioId",
    ];

    camposActualizables.forEach((campo) => {
      if (pagoAdminData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(pagoAdminData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    values.push(id);

    const query = `
      UPDATE "pagoadmin"
      SET ${updateFields.join(", ")}
      WHERE "PagoAdminId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontró el registro
    }

    // Obtener el registro actualizado
    return PagoAdmin.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "pagoadmin" WHERE "PagoAdminId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = PagoAdmin;
