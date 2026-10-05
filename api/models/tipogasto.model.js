const db = require("../config/db");

const TipoGasto = {
  getAll: async () => {
    const result = await db.query(
      'SELECT * FROM "tipogasto" ORDER BY "TipoGastoId"'
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "tipogasto" WHERE "TipoGastoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (data) => {
    const result = await db.query(
      'INSERT INTO "tipogasto" ("TipoGastoDescripcion", "TipoGastoCantGastos") VALUES ($1, $2) RETURNING "TipoGastoId"',
      [data.TipoGastoDescripcion, data.TipoGastoCantGastos]
    );
    return TipoGasto.getById(result.rows[0].TipoGastoId);
  },

  update: async (id, data) => {
    // "TipoGastoCantGastos" lo mantiene el alta de grupos; no se toma del
    // formulario, que puede traer un valor viejo.
    const result = await db.query(
      'UPDATE "tipogasto" SET "TipoGastoDescripcion" = $1 WHERE "TipoGastoId" = $2',
      [data.TipoGastoDescripcion, id]
    );
    if (result.rowCount === 0) return null;
    return TipoGasto.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "tipogasto" WHERE "TipoGastoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "TipoGastoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "TipoGastoId",
      "TipoGastoDescripcion",
      "TipoGastoCantGastos",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "TipoGastoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "tipogasto" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "tipogasto"'
    );

    return {
      tipoGastos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchTipoGastos: async (
    term,
    limit,
    offset,
    sortBy = "TipoGastoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "TipoGastoId",
      "TipoGastoDescripcion",
      "TipoGastoCantGastos",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "TipoGastoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "tipogasto"
        WHERE "TipoGastoDescripcion" ILIKE $1
        OR CAST("TipoGastoCantGastos" AS TEXT) ILIKE $2
        ORDER BY "${sortField}" ${order}
        LIMIT $3 OFFSET $4`,
      [searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "tipogasto"
        WHERE "TipoGastoDescripcion" ILIKE $1
        OR CAST("TipoGastoCantGastos" AS TEXT) ILIKE $2`,
      [searchValue, searchValue]
    );

    return {
      tipoGastos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = TipoGasto;
