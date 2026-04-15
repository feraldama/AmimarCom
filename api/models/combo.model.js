const db = require("../config/db");

const Combo = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "combo"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "combo" WHERE "ComboId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (comboData) => {
    const result = await db.query(
      'INSERT INTO "combo" ("ComboDescripcion", "ProductoId", "ComboCantidad", "ComboPrecio") VALUES ($1, $2, $3, $4) RETURNING "ComboId"',
      [
        comboData.ComboDescripcion || "",
        comboData.ProductoId,
        comboData.ComboCantidad,
        comboData.ComboPrecio,
      ]
    );
    return Combo.getById(result.rows[0].ComboId);
  },

  update: async (id, comboData) => {
    const result = await db.query(
      'UPDATE "combo" SET "ComboDescripcion" = $1, "ProductoId" = $2, "ComboCantidad" = $3, "ComboPrecio" = $4 WHERE "ComboId" = $5',
      [
        comboData.ComboDescripcion || "",
        comboData.ProductoId,
        comboData.ComboCantidad,
        comboData.ComboPrecio,
        id,
      ]
    );
    if (result.rowCount === 0) return null;
    return Combo.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "combo" WHERE "ComboId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "ComboId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ComboId",
      "ComboDescripcion",
      "ProductoId",
      "ComboCantidad",
      "ComboPrecio",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "ComboId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "combo" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "combo"'
    );

    return {
      combos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (term, limit, offset, sortBy = "ComboId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ComboId",
      "ComboDescripcion",
      "ProductoId",
      "ComboCantidad",
      "ComboPrecio",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "ComboId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT c."ComboId", c."ComboDescripcion", c."ProductoId", c."ComboCantidad", c."ComboPrecio", p."ProductoNombre"
        FROM "combo" c
        LEFT JOIN "producto" p ON c."ProductoId" = p."ProductoId"
        WHERE c."ComboDescripcion" ILIKE $1 OR p."ProductoNombre" ILIKE $2
        ORDER BY c."${sortField}" ${order}
        LIMIT $3 OFFSET $4`,
      [searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total
        FROM "combo" c
        LEFT JOIN "producto" p ON c."ProductoId" = p."ProductoId"
        WHERE c."ComboDescripcion" ILIKE $1 OR p."ProductoNombre" ILIKE $2`,
      [searchValue, searchValue]
    );

    return {
      combos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = Combo;
