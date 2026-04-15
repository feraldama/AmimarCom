const db = require("../config/db");

const VentaCreditoPago = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "ventacreditopago"');
    return result.rows;
  },

  getById: async (ventaCreditoId, pagoId) => {
    const result = await db.query(
      'SELECT * FROM "ventacreditopago" WHERE "VentaCreditoId" = $1 AND "VentaCreditoPagoId" = $2',
      [ventaCreditoId, pagoId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByVentaCreditoId: async (ventaCreditoId) => {
    const result = await db.query(
      'SELECT * FROM "ventacreditopago" WHERE "VentaCreditoId" = $1',
      [ventaCreditoId]
    );
    return result.rows;
  },

  create: async (data) => {
    await db.query(
      `INSERT INTO "ventacreditopago" (
        "VentaCreditoId",
        "VentaCreditoPagoId",
        "VentaCreditoPagoFecha",
        "VentaCreditoPagoMonto"
      ) VALUES ($1, $2, $3, $4)`,
      [
        data.VentaCreditoId,
        data.VentaCreditoPagoId,
        data.VentaCreditoPagoFecha,
        data.VentaCreditoPagoMonto,
      ]
    );
    return VentaCreditoPago.getById(data.VentaCreditoId, data.VentaCreditoPagoId);
  },

  update: async (ventaCreditoId, pagoId, data) => {
    const result = await db.query(
      `UPDATE "ventacreditopago" SET
        "VentaCreditoPagoFecha" = $1,
        "VentaCreditoPagoMonto" = $2
        WHERE "VentaCreditoId" = $3 AND "VentaCreditoPagoId" = $4`,
      [
        data.VentaCreditoPagoFecha,
        data.VentaCreditoPagoMonto,
        ventaCreditoId,
        pagoId,
      ]
    );
    if (result.rowCount === 0) return null;
    return VentaCreditoPago.getById(ventaCreditoId, pagoId);
  },

  delete: async (ventaCreditoId, pagoId) => {
    const result = await db.query(
      'DELETE FROM "ventacreditopago" WHERE "VentaCreditoId" = $1 AND "VentaCreditoPagoId" = $2',
      [ventaCreditoId, pagoId]
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
      "VentaCreditoPagoId",
      "VentaCreditoPagoFecha",
      "VentaCreditoPagoMonto",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "VentaCreditoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "ventacreditopago" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "ventacreditopago"'
    );

    return {
      pagos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchPagos: async (
    term,
    limit,
    offset,
    sortBy = "VentaCreditoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "VentaCreditoId",
      "VentaCreditoPagoId",
      "VentaCreditoPagoFecha",
      "VentaCreditoPagoMonto",
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
      `SELECT * FROM "ventacreditopago"
        WHERE CAST("VentaCreditoId" AS TEXT) ILIKE $1
        OR CAST("VentaCreditoPagoId" AS TEXT) ILIKE $2
        OR CAST("VentaCreditoPagoFecha" AS TEXT) ILIKE $3
        OR CAST("VentaCreditoPagoMonto" AS TEXT) ILIKE $4
        ORDER BY "${sortField}" ${order}
        LIMIT $5 OFFSET $6`,
      [searchValue, searchValue, searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "ventacreditopago"
        WHERE CAST("VentaCreditoId" AS TEXT) ILIKE $1
        OR CAST("VentaCreditoPagoId" AS TEXT) ILIKE $2
        OR CAST("VentaCreditoPagoFecha" AS TEXT) ILIKE $3
        OR CAST("VentaCreditoPagoMonto" AS TEXT) ILIKE $4`,
      [searchValue, searchValue, searchValue, searchValue]
    );

    return {
      pagos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = VentaCreditoPago;
