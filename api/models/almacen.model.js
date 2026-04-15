const db = require("../config/db");

const Almacen = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "almacen"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "almacen" WHERE "AlmacenId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (almacenData) => {
    const result = await db.query(
      'INSERT INTO "almacen" ("AlmacenNombre") VALUES ($1) RETURNING "AlmacenId"',
      [almacenData.AlmacenNombre]
    );
    return Almacen.getById(result.rows[0].AlmacenId);
  },

  update: async (id, almacenData) => {
    const result = await db.query(
      'UPDATE "almacen" SET "AlmacenNombre" = $1 WHERE "AlmacenId" = $2',
      [almacenData.AlmacenNombre, id]
    );
    if (result.rowCount === 0) return null;
    return Almacen.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "almacen" WHERE "AlmacenId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "AlmacenId", sortOrder = "ASC") => {
    const allowedSortFields = ["AlmacenId", "AlmacenNombre"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "AlmacenId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "almacen" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "almacen"'
    );

    return {
      almacenes: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchAlmacenes: async (
    term,
    limit,
    offset,
    sortBy = "AlmacenId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = ["AlmacenId", "AlmacenNombre"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "AlmacenId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "almacen"
        WHERE "AlmacenNombre" ILIKE $1
        ORDER BY "${sortField}" ${order}
        LIMIT $2 OFFSET $3`,
      [searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "almacen"
        WHERE "AlmacenNombre" ILIKE $1`,
      [searchValue]
    );

    return {
      almacenes: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = Almacen;
