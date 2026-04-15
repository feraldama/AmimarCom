const db = require("../config/db");

const CajaTipo = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "cajatipo"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "cajatipo" WHERE "CajaTipoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (cajaTipoData) => {
    const query = `INSERT INTO "cajatipo" ("CajaTipoDescripcion") VALUES ($1) RETURNING "CajaTipoId"`;
    const values = [cajaTipoData.CajaTipoDescripcion];
    const result = await db.query(query, values);
    // Obtener el tipo de caja recién creado
    const cajaTipo = await CajaTipo.getById(result.rows[0].CajaTipoId);
    return cajaTipo;
  },

  update: async (id, cajaTipoData) => {
    const query = `UPDATE "cajatipo" SET "CajaTipoDescripcion" = $1 WHERE "CajaTipoId" = $2`;
    const values = [cajaTipoData.CajaTipoDescripcion, id];
    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    const cajaTipo = await CajaTipo.getById(id);
    return cajaTipo;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "cajatipo" WHERE "CajaTipoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "CajaTipoId", sortOrder = "ASC") => {
    const allowedSortFields = ["CajaTipoId", "CajaTipoDescripcion"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CajaTipoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "cajatipo" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) as total FROM "cajatipo"');

    return {
      cajaTipos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchCajaTipos: async (
    term,
    limit,
    offset,
    sortBy = "CajaTipoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = ["CajaTipoId", "CajaTipoDescripcion"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CajaTipoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT * FROM "cajatipo"
      WHERE "CajaTipoDescripcion" ILIKE $1
      ORDER BY "${sortField}" ${order}
      LIMIT $2 OFFSET $3
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(searchQuery, [searchValue, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "cajatipo"
      WHERE "CajaTipoDescripcion" ILIKE $1
    `;
    const countResult = await db.query(countQuery, [searchValue]);

    return {
      cajaTipos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = CajaTipo;
