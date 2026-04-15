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
    sortOrder = "DESC"
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

    const query = `
      SELECT p.*,
        c."CajaDescripcion",
        co."CajaDescripcion" as "CajaOrigenDescripcion"
      FROM "pagoadmin" p
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "caja" co ON p."CajaOrigenId" = co."CajaId"
      ORDER BY p."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "pagoadmin"'
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
    sortOrder = "DESC"
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

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT p.*,
        c."CajaDescripcion",
        co."CajaDescripcion" as "CajaOrigenDescripcion"
      FROM "pagoadmin" p
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "caja" co ON p."CajaOrigenId" = co."CajaId"
      WHERE p."PagoAdminDetalle" ILIKE $1
        OR CAST(p."UsuarioId" AS TEXT) ILIKE $2
        OR CAST(p."CajaId" AS TEXT) ILIKE $3
        OR CAST(p."CajaOrigenId" AS TEXT) ILIKE $4
        OR CAST(p."PagoAdminMonto" AS TEXT) ILIKE $5
        OR TO_CHAR(p."PagoAdminFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $6
      ORDER BY p."${sortField}" ${order}
      LIMIT $7 OFFSET $8
    `;

    const result = await db.query(searchQuery, [
      searchValue, // Detalle
      searchValue, // UsuarioId
      searchValue, // CajaId
      searchValue, // CajaOrigenId
      searchValue, // Monto
      searchValue, // Fecha
      limit,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "pagoadmin"
      WHERE "PagoAdminDetalle" ILIKE $1
        OR CAST("UsuarioId" AS TEXT) ILIKE $2
        OR CAST("CajaId" AS TEXT) ILIKE $3
        OR CAST("CajaOrigenId" AS TEXT) ILIKE $4
        OR CAST("PagoAdminMonto" AS TEXT) ILIKE $5
        OR TO_CHAR("PagoAdminFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $6
    `;

    const countResult = await db.query(countQuery, [
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

  create: async (pagoAdminData) => {
    const query = `
      INSERT INTO "pagoadmin" (
        "CajaOrigenId",
        "CajaId",
        "PagoAdminFecha",
        "PagoAdminDetalle",
        "PagoAdminMonto",
        "UsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "PagoAdminId"
    `;

    const values = [
      pagoAdminData.CajaOrigenId,
      pagoAdminData.CajaId,
      pagoAdminData.PagoAdminFecha || new Date(),
      pagoAdminData.PagoAdminDetalle,
      pagoAdminData.PagoAdminMonto,
      pagoAdminData.UsuarioId,
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
