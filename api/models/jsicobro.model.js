const db = require("../config/db");

const JSICobro = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "jsicobro"');
    return result.rows;
  },

  getById: async (id) => {
    const query = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      WHERE j."JSICobroId" = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "JSICobroId",
    sortOrder = "DESC"
  ) => {
    // Sanitiza sortOrder y sortBy para evitar SQL Injection
    const allowedSortFields = [
      "JSICobroId",
      "CajaId",
      "JSICobroFecha",
      "JSICobroCod",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "JSICobroFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      ORDER BY j."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "jsicobro"'
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
    sortBy = "JSICobroFecha",
    sortOrder = "DESC"
  ) => {
    // Sanitiza los campos para evitar SQL Injection
    const allowedSortFields = [
      "JSICobroId",
      "CajaId",
      "JSICobroFecha",
      "JSICobroCod",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "JSICobroFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      WHERE j."JSICobroCod" ILIKE $1
        OR CAST(j."JSICobroId" AS TEXT) ILIKE $2
        OR CAST(j."CajaId" AS TEXT) ILIKE $3
        OR CAST(j."ClienteId" AS TEXT) ILIKE $4
        OR CAST(j."JSICobroMonto" AS TEXT) ILIKE $5
        OR CAST(j."JSICobroUsuarioId" AS TEXT) ILIKE $6
        OR TO_CHAR(j."JSICobroFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $7
        OR cl."ClienteNombre" ILIKE $8
        OR cl."ClienteApellido" ILIKE $9
        OR c."CajaDescripcion" ILIKE $10
      ORDER BY j."${sortField}" ${order}
      LIMIT $11 OFFSET $12
    `;

    const result = await db.query(searchQuery, [
      searchValue, // JSICobroCod
      searchValue, // JSICobroId
      searchValue, // CajaId
      searchValue, // ClienteId
      searchValue, // JSICobroMonto
      searchValue, // JSICobroUsuarioId
      searchValue, // JSICobroFecha
      searchValue, // ClienteNombre
      searchValue, // ClienteApellido
      searchValue, // CajaDescripcion
      limit,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      WHERE j."JSICobroCod" ILIKE $1
        OR CAST(j."JSICobroId" AS TEXT) ILIKE $2
        OR CAST(j."CajaId" AS TEXT) ILIKE $3
        OR CAST(j."ClienteId" AS TEXT) ILIKE $4
        OR CAST(j."JSICobroMonto" AS TEXT) ILIKE $5
        OR CAST(j."JSICobroUsuarioId" AS TEXT) ILIKE $6
        OR TO_CHAR(j."JSICobroFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $7
        OR cl."ClienteNombre" ILIKE $8
        OR cl."ClienteApellido" ILIKE $9
        OR c."CajaDescripcion" ILIKE $10
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

  create: async (jsicobroData) => {
    const query = `
      INSERT INTO "jsicobro" (
        "CajaId",
        "JSICobroFecha",
        "JSICobroCod",
        "ClienteId",
        "JSICobroMonto",
        "JSICobroUsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "JSICobroId"
    `;

    const values = [
      jsicobroData.CajaId || null,
      jsicobroData.JSICobroFecha || new Date(),
      jsicobroData.JSICobroCod || "",
      jsicobroData.ClienteId || null,
      jsicobroData.JSICobroMonto || 0,
      jsicobroData.JSICobroUsuarioId || null,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return JSICobro.getById(result.rows[0].JSICobroId);
  },

  update: async (id, jsicobroData) => {
    // Construir la consulta dinámicamente
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaId",
      "JSICobroFecha",
      "JSICobroCod",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];

    camposActualizables.forEach((campo) => {
      if (jsicobroData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(jsicobroData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    values.push(id);

    const query = `
      UPDATE "jsicobro"
      SET ${updateFields.join(", ")}
      WHERE "JSICobroId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontró el registro
    }

    // Obtener el registro actualizado
    return JSICobro.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "jsicobro" WHERE "JSICobroId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = JSICobro;
