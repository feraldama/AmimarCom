const db = require("../config/db");

const CompraProducto = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "compraproducto"');
    return result.rows;
  },

  getById: async (compraId, compraProductoId) => {
    const result = await db.query(
      'SELECT * FROM "compraproducto" WHERE "CompraId" = $1 AND "CompraProductoId" = $2',
      [compraId, compraProductoId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByCompraId: async (compraId) => {
    const query = `
      SELECT
        cp.*,
        p."ProductoNombre",
        p."ProductoCodigo",
        p."ProductoPrecioVenta",
        p."ProductoIVA"
      FROM "compraproducto" cp
      LEFT JOIN "producto" p ON cp."ProductoId" = p."ProductoId"
      WHERE cp."CompraId" = $1
    `;

    const result = await db.query(query, [compraId]);
    return result.rows;
  },

  create: async (data) => {
    const query = `INSERT INTO "compraproducto" (
      "CompraId",
      "CompraProductoId",
      "ProductoId",
      "CompraProductoCantidad",
      "CompraProductoCantidadUnidad",
      "CompraProductoBonificacion",
      "CompraProductoPrecio",
      "AlmacenOrigenId"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

    const values = [
      data.CompraId,
      data.CompraProductoId,
      data.ProductoId,
      data.CompraProductoCantidad,
      data.CompraProductoCantidadUnidad || "U",
      data.CompraProductoBonificacion || 0,
      data.CompraProductoPrecio,
      data.AlmacenOrigenId,
    ];

    await db.query(query, values);
    const compraProducto = await CompraProducto.getById(data.CompraId, data.CompraProductoId);
    return compraProducto;
  },

  createMultiple: async (compraProductos) => {
    if (!compraProductos || compraProductos.length === 0) {
      return [];
    }

    const query = `
      INSERT INTO "compraproducto" (
        "CompraId",
        "CompraProductoId",
        "ProductoId",
        "CompraProductoCantidad",
        "CompraProductoCantidadUnidad",
        "CompraProductoBonificacion",
        "CompraProductoPrecio",
        "AlmacenOrigenId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const resultados = [];
    for (const cp of compraProductos) {
      const values = [
        cp.CompraId,
        cp.CompraProductoId,
        cp.ProductoId,
        cp.CompraProductoCantidad,
        cp.CompraProductoCantidadUnidad || "U",
        cp.CompraProductoBonificacion || 0,
        cp.CompraProductoPrecio,
        cp.AlmacenOrigenId,
      ];

      await db.query(query, values);
      resultados.push(cp);
    }
    return resultados;
  },

  deleteByCompraId: async (compraId) => {
    const result = await db.query(
      'DELETE FROM "compraproducto" WHERE "CompraId" = $1',
      [compraId]
    );
    return result.rowCount > 0;
  },

  update: async (compraId, compraProductoId, data) => {
    const query = `UPDATE "compraproducto" SET
      "ProductoId" = $1,
      "CompraProductoCantidad" = $2,
      "CompraProductoCantidadUnidad" = $3,
      "CompraProductoBonificacion" = $4,
      "CompraProductoPrecio" = $5,
      "AlmacenOrigenId" = $6
      WHERE "CompraId" = $7 AND "CompraProductoId" = $8`;

    const values = [
      data.ProductoId,
      data.CompraProductoCantidad,
      data.CompraProductoCantidadUnidad || "U",
      data.CompraProductoBonificacion || 0,
      data.CompraProductoPrecio,
      data.AlmacenOrigenId,
      compraId,
      compraProductoId,
    ];

    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    const compraProducto = await CompraProducto.getById(compraId, compraProductoId);
    return compraProducto;
  },

  delete: async (compraId, compraProductoId) => {
    const result = await db.query(
      'DELETE FROM "compraproducto" WHERE "CompraId" = $1 AND "CompraProductoId" = $2',
      [compraId, compraProductoId]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "CompraId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "CompraId",
      "CompraProductoId",
      "ProductoId",
      "CompraProductoCantidad",
      "CompraProductoCantidadUnidad",
      "CompraProductoBonificacion",
      "CompraProductoPrecio",
      "AlmacenOrigenId",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CompraId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "compraproducto" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "compraproducto"'
    );

    return {
      compraProductos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchCompraProductos: async (
    term,
    limit,
    offset,
    sortBy = "CompraId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "CompraId",
      "CompraProductoId",
      "ProductoId",
      "CompraProductoCantidad",
      "CompraProductoCantidadUnidad",
      "CompraProductoBonificacion",
      "CompraProductoPrecio",
      "AlmacenOrigenId",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CompraId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT * FROM "compraproducto"
      WHERE CAST("CompraId" AS TEXT) ILIKE $1
      OR CAST("CompraProductoId" AS TEXT) ILIKE $2
      OR CAST("ProductoId" AS TEXT) ILIKE $3
      OR CAST("CompraProductoCantidad" AS TEXT) ILIKE $4
      OR "CompraProductoCantidadUnidad" ILIKE $5
      OR CAST("CompraProductoBonificacion" AS TEXT) ILIKE $6
      OR CAST("CompraProductoPrecio" AS TEXT) ILIKE $7
      OR CAST("AlmacenOrigenId" AS TEXT) ILIKE $8
      ORDER BY "${sortField}" ${order}
      LIMIT $9 OFFSET $10
    `;

    const searchValue = `%${term}%`;
    const values = Array(8).fill(searchValue).concat([limit, offset]);

    const result = await db.query(searchQuery, values);

    const countQuery = `
      SELECT COUNT(*) as total FROM "compraproducto"
      WHERE CAST("CompraId" AS TEXT) ILIKE $1
      OR CAST("CompraProductoId" AS TEXT) ILIKE $2
      OR CAST("ProductoId" AS TEXT) ILIKE $3
      OR CAST("CompraProductoCantidad" AS TEXT) ILIKE $4
      OR "CompraProductoCantidadUnidad" ILIKE $5
      OR CAST("CompraProductoBonificacion" AS TEXT) ILIKE $6
      OR CAST("CompraProductoPrecio" AS TEXT) ILIKE $7
      OR CAST("AlmacenOrigenId" AS TEXT) ILIKE $8
    `;

    const countResult = await db.query(countQuery, Array(8).fill(searchValue));

    return {
      compraProductos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = CompraProducto;
