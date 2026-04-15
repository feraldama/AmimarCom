const db = require("../config/db");

const VentaProducto = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "ventaproducto"');
    return result.rows;
  },

  getById: async (ventaId, productoId) => {
    const result = await db.query(
      'SELECT * FROM "ventaproducto" WHERE "VentaId" = $1 AND "VentaProductoId" = $2',
      [ventaId, productoId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByVentaId: async (ventaId) => {
    const query = `
      SELECT
        vp.*,
        p."ProductoNombre",
        p."ProductoCodigo",
        p."ProductoPrecioVenta",
        p."ProductoIVA"
      FROM "ventaproducto" vp
      LEFT JOIN "producto" p ON vp."ProductoId" = p."ProductoId"
      WHERE vp."VentaId" = $1
    `;

    const result = await db.query(query, [ventaId]);
    return result.rows;
  },

  create: async (data) => {
    const query = `INSERT INTO "ventaproducto" (
      "VentaId",
      "VentaProductoId",
      "ProductoId",
      "VentaProductoPrecioPromedio",
      "VentaProductoCantidad",
      "VentaProductoPrecio",
      "VentaProductoPrecioTotal",
      "VentaProductoUnitario"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

    const values = [
      data.VentaId,
      data.VentaProductoId,
      data.ProductoId,
      data.VentaProductoPrecioPromedio,
      data.VentaProductoCantidad,
      data.VentaProductoPrecio,
      data.VentaProductoPrecioTotal,
      data.VentaProductoUnitario,
    ];

    await db.query(query, values);
    const ventaProducto = await VentaProducto.getById(data.VentaId, data.VentaProductoId);
    return ventaProducto;
  },

  update: async (ventaId, productoId, data) => {
    const query = `UPDATE "ventaproducto" SET
      "ProductoId" = $1,
      "VentaProductoPrecioPromedio" = $2,
      "VentaProductoCantidad" = $3,
      "VentaProductoPrecio" = $4,
      "VentaProductoPrecioTotal" = $5,
      "VentaProductoUnitario" = $6
      WHERE "VentaId" = $7 AND "VentaProductoId" = $8`;

    const values = [
      data.ProductoId,
      data.VentaProductoPrecioPromedio,
      data.VentaProductoCantidad,
      data.VentaProductoPrecio,
      data.VentaProductoPrecioTotal,
      data.VentaProductoUnitario,
      ventaId,
      productoId,
    ];

    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    const ventaProducto = await VentaProducto.getById(ventaId, productoId);
    return ventaProducto;
  },

  delete: async (ventaId, productoId) => {
    const result = await db.query(
      'DELETE FROM "ventaproducto" WHERE "VentaId" = $1 AND "VentaProductoId" = $2',
      [ventaId, productoId]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "VentaId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "VentaId",
      "VentaProductoId",
      "ProductoId",
      "VentaProductoPrecioPromedio",
      "VentaProductoCantidad",
      "VentaProductoPrecio",
      "VentaProductoPrecioTotal",
      "VentaProductoUnitario",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "VentaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "ventaproducto" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "ventaproducto"'
    );

    return {
      ventaProductos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchVentaProductos: async (
    term,
    limit,
    offset,
    sortBy = "VentaId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "VentaId",
      "VentaProductoId",
      "ProductoId",
      "VentaProductoPrecioPromedio",
      "VentaProductoCantidad",
      "VentaProductoPrecio",
      "VentaProductoPrecioTotal",
      "VentaProductoUnitario",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "VentaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT * FROM "ventaproducto"
      WHERE CAST("VentaId" AS TEXT) ILIKE $1
      OR CAST("VentaProductoId" AS TEXT) ILIKE $2
      OR CAST("ProductoId" AS TEXT) ILIKE $3
      OR CAST("VentaProductoPrecioPromedio" AS TEXT) ILIKE $4
      OR CAST("VentaProductoCantidad" AS TEXT) ILIKE $5
      OR CAST("VentaProductoPrecio" AS TEXT) ILIKE $6
      OR CAST("VentaProductoPrecioTotal" AS TEXT) ILIKE $7
      OR CAST("VentaProductoUnitario" AS TEXT) ILIKE $8
      ORDER BY "${sortField}" ${order}
      LIMIT $9 OFFSET $10
    `;

    const searchValue = `%${term}%`;
    const values = Array(8).fill(searchValue).concat([limit, offset]);

    const result = await db.query(searchQuery, values);

    const countQuery = `
      SELECT COUNT(*) as total FROM "ventaproducto"
      WHERE CAST("VentaId" AS TEXT) ILIKE $1
      OR CAST("VentaProductoId" AS TEXT) ILIKE $2
      OR CAST("ProductoId" AS TEXT) ILIKE $3
      OR CAST("VentaProductoPrecioPromedio" AS TEXT) ILIKE $4
      OR CAST("VentaProductoCantidad" AS TEXT) ILIKE $5
      OR CAST("VentaProductoPrecio" AS TEXT) ILIKE $6
      OR CAST("VentaProductoPrecioTotal" AS TEXT) ILIKE $7
      OR CAST("VentaProductoUnitario" AS TEXT) ILIKE $8
    `;

    const countResult = await db.query(countQuery, Array(8).fill(searchValue));

    return {
      ventaProductos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = VentaProducto;
