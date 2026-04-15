const db = require("../config/db");

const Local = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "local"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "local" WHERE "LocalId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "LocalId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "LocalId",
      "LocalNombre",
      "LocalTelefono",
      "LocalCelular",
      "LocalDireccion",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "LocalId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "local" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "local"'
    );

    return {
      locales: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (term, limit, offset, sortBy = "LocalId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "LocalId",
      "LocalNombre",
      "LocalTelefono",
      "LocalCelular",
      "LocalDireccion",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "LocalId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "local"
        WHERE "LocalNombre" ILIKE $1
        OR "LocalTelefono" ILIKE $2
        OR "LocalCelular" ILIKE $3
        OR "LocalDireccion" ILIKE $4
        OR CAST("LocalId" AS TEXT) ILIKE $5
        ORDER BY "${sortField}" ${order}
        LIMIT $6 OFFSET $7`,
      [searchValue, searchValue, searchValue, searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "local"
        WHERE "LocalNombre" ILIKE $1
        OR "LocalTelefono" ILIKE $2
        OR "LocalCelular" ILIKE $3
        OR "LocalDireccion" ILIKE $4
        OR CAST("LocalId" AS TEXT) ILIKE $5`,
      [searchValue, searchValue, searchValue, searchValue, searchValue]
    );

    return {
      locales: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (localData) => {
    const result = await db.query(
      `INSERT INTO "local" (
        "LocalNombre",
        "LocalTelefono",
        "LocalCelular",
        "LocalDireccion"
      ) VALUES ($1, $2, $3, $4) RETURNING "LocalId"`,
      [
        localData.LocalNombre,
        localData.LocalTelefono,
        localData.LocalCelular,
        localData.LocalDireccion,
      ]
    );
    return {
      LocalId: result.rows[0].LocalId,
      ...localData,
    };
  },

  update: async (id, localData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    const camposActualizables = [
      "LocalNombre",
      "LocalTelefono",
      "LocalCelular",
      "LocalDireccion",
    ];

    camposActualizables.forEach((campo) => {
      if (localData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(localData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE "local"
      SET ${updateFields.join(", ")}
      WHERE "LocalId" = $${paramIndex}
    `;

    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return null;
    }
    return Local.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "local" WHERE "LocalId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Local;
