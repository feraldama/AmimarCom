const db = require("../config/db");

const Divisa = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "divisa"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "divisa" WHERE "DivisaId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "DivisaId", sortOrder = "DESC") => {
    const allowedSortFields = [
      "DivisaId",
      "DivisaNombre",
      "DivisaCompraMonto",
      "DivisaVentaMonto",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "DivisaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT * FROM "divisa"
      ORDER BY "${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query('SELECT COUNT(*) as total FROM "divisa"');

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
    sortBy = "DivisaId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "DivisaId",
      "DivisaNombre",
      "DivisaCompraMonto",
      "DivisaVentaMonto",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "DivisaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchQuery = `
      SELECT * FROM "divisa"
      WHERE "DivisaNombre" ILIKE $1
        OR CAST("DivisaId" AS TEXT) ILIKE $2
        OR CAST("DivisaCompraMonto" AS TEXT) ILIKE $3
        OR CAST("DivisaVentaMonto" AS TEXT) ILIKE $4
      ORDER BY "${sortField}" ${order}
      LIMIT $5 OFFSET $6
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(
      searchQuery,
      [searchValue, searchValue, searchValue, searchValue, limit, offset]
    );

    const countQuery = `
      SELECT COUNT(*) as total FROM "divisa"
      WHERE "DivisaNombre" ILIKE $1
        OR CAST("DivisaId" AS TEXT) ILIKE $2
        OR CAST("DivisaCompraMonto" AS TEXT) ILIKE $3
        OR CAST("DivisaVentaMonto" AS TEXT) ILIKE $4
    `;

    const countResult = await db.query(
      countQuery,
      [searchValue, searchValue, searchValue, searchValue]
    );

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

  create: async (divisaData) => {
    const query = `
      INSERT INTO "divisa" (
        "DivisaNombre",
        "DivisaCompraMonto",
        "DivisaVentaMonto"
      ) VALUES ($1, $2, $3) RETURNING "DivisaId"
    `;

    const values = [
      divisaData.DivisaNombre,
      divisaData.DivisaCompraMonto || 0,
      divisaData.DivisaVentaMonto || 0,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    const divisa = await Divisa.getById(result.rows[0].DivisaId);
    return divisa;
  },

  update: async (id, divisaData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "DivisaNombre",
      "DivisaCompraMonto",
      "DivisaVentaMonto",
    ];

    camposActualizables.forEach((campo) => {
      if (divisaData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        values.push(divisaData[campo]);
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE "divisa"
      SET ${updateFields.join(", ")}
      WHERE "DivisaId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const divisa = await Divisa.getById(id);
    return divisa;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "divisa" WHERE "DivisaId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Divisa;
