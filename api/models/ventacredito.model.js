const db = require("../config/db");

const VentaCredito = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "ventacredito"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "ventacredito" WHERE "VentaCreditoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByVentaId: async (ventaId) => {
    const result = await db.query(
      'SELECT * FROM "ventacredito" WHERE "VentaId" = $1',
      [ventaId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (data) => {
    const result = await db.query(
      `INSERT INTO "ventacredito" (
        "VentaId",
        "VentaCreditoPagoCant"
      ) VALUES ($1, $2) RETURNING "VentaCreditoId"`,
      [data.VentaId, data.VentaCreditoPagoCant]
    );
    return VentaCredito.getById(result.rows[0].VentaCreditoId);
  },

  update: async (id, data) => {
    const result = await db.query(
      `UPDATE "ventacredito" SET
        "VentaId" = $1,
        "VentaCreditoPagoCant" = $2
        WHERE "VentaCreditoId" = $3`,
      [data.VentaId, data.VentaCreditoPagoCant, id]
    );
    if (result.rowCount === 0) return null;
    return VentaCredito.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "ventacredito" WHERE "VentaCreditoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "VentaCreditoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "VentaCreditoId",
      "VentaId",
      "VentaCreditoPagoCant",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "VentaCreditoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "ventacredito" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "ventacredito"'
    );

    return {
      ventaCreditos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchVentaCreditos: async (
    term,
    limit,
    offset,
    sortBy = "VentaCreditoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "VentaCreditoId",
      "VentaId",
      "VentaCreditoPagoCant",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "VentaCreditoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "ventacredito"
        WHERE CAST("VentaCreditoId" AS TEXT) ILIKE $1
        OR CAST("VentaId" AS TEXT) ILIKE $2
        OR CAST("VentaCreditoPagoCant" AS TEXT) ILIKE $3
        ORDER BY "${sortField}" ${order}
        LIMIT $4 OFFSET $5`,
      [searchValue, searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "ventacredito"
        WHERE CAST("VentaCreditoId" AS TEXT) ILIKE $1
        OR CAST("VentaId" AS TEXT) ILIKE $2
        OR CAST("VentaCreditoPagoCant" AS TEXT) ILIKE $3`,
      [searchValue, searchValue, searchValue]
    );

    return {
      ventaCreditos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = VentaCredito;
