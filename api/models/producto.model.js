const db = require("../config/db");

const Producto = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "producto"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT p.*, l."LocalNombre" FROM "producto" p LEFT JOIN "local" l ON p."LocalId" = l."LocalId" WHERE p."ProductoId" = $1',
      [id]
    );
    const producto = result.rows.length > 0 ? result.rows[0] : null;
    if (!producto) return null;

    const almacenResult = await db.query(
      `SELECT pa."ProductoId", pa."AlmacenId", pa."ProductoAlmacenStock", pa."ProductoAlmacenStockUnitario", a."AlmacenNombre"
       FROM "productoalmacen" pa
       LEFT JOIN "almacen" a ON pa."AlmacenId" = a."AlmacenId"
       WHERE pa."ProductoId" = $1`,
      [id]
    );
    producto.productoAlmacen = almacenResult.rows || [];
    return producto;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "ProductoId",
    sortOrder = "ASC",
    localId = null
  ) => {
    const allowedSortFields = [
      "ProductoId",
      "ProductoCodigo",
      "ProductoNombre",
      "ProductoPrecioVenta",
      "ProductoPrecioVentaMayorista",
      "ProductoPrecioUnitario",
      "ProductoPrecioPromedio",
      "ProductoStock",
      "ProductoStockUnitario",
      "ProductoCantidadCaja",
      "ProductoIVA",
      "ProductoStockMinimo",
      "ProductoImagen",
      "ProductoImagen_GXI",
      "LocalId",
      "LocalNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ProductoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const orderByField =
      sortField === "ProductoStock" || sortField === "ProductoStockUnitario"
        ? `"${sortField}"`
        : sortField === "LocalNombre"
          ? `l."${sortField}"`
          : `p."${sortField}"`;

    // Ahora el stock total viene directamente de la tabla producto
    const queryPaginated = `
      SELECT p.*, l."LocalNombre"
      FROM "producto" p
      LEFT JOIN "local" l ON p."LocalId" = l."LocalId"
      ORDER BY ${orderByField} ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(queryPaginated, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "producto"'
    );

    return {
      productos: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (
    term,
    limit,
    offset,
    sortBy = "ProductoId",
    sortOrder = "ASC",
    localId = null
  ) => {
    const allowedSortFields = [
      "ProductoId",
      "ProductoCodigo",
      "ProductoNombre",
      "ProductoPrecioVenta",
      "ProductoPrecioVentaMayorista",
      "ProductoPrecioUnitario",
      "ProductoPrecioPromedio",
      "ProductoStock",
      "ProductoStockUnitario",
      "ProductoCantidadCaja",
      "ProductoIVA",
      "ProductoStockMinimo",
      "ProductoImagen",
      "ProductoImagen_GXI",
      "LocalId",
      "LocalNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ProductoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const orderByField =
      sortField === "ProductoStock" || sortField === "ProductoStockUnitario"
        ? `"${sortField}"`
        : sortField === "LocalNombre"
          ? `l."${sortField}"`
          : `p."${sortField}"`;

    // En busqueda tambien usamos el stock directo de producto
    const searchQuery = `
      SELECT p.*, l."LocalNombre"
      FROM "producto" p
      LEFT JOIN "local" l ON p."LocalId" = l."LocalId"
      WHERE p."ProductoNombre" ILIKE $1
      OR p."ProductoCodigo" ILIKE $2
      OR l."LocalNombre" ILIKE $3
      ORDER BY ${orderByField} ${order}
      LIMIT $4 OFFSET $5
    `;
    const searchValue = `%${term}%`;
    const searchParams = [
      searchValue,
      searchValue,
      searchValue,
      limit,
      offset,
    ];

    const result = await db.query(searchQuery, searchParams);

    const countQuery = `
      SELECT COUNT(*) as total FROM "producto" p
      LEFT JOIN "local" l ON p."LocalId" = l."LocalId"
      WHERE p."ProductoNombre" ILIKE $1
      OR p."ProductoCodigo" ILIKE $2
      OR l."LocalNombre" ILIKE $3
    `;

    const countResult = await db.query(
      countQuery,
      [searchValue, searchValue, searchValue]
    );

    return {
      productos: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (productoData) => {
    const imagenBuffer = productoData.ProductoImagen
      ? Buffer.from(productoData.ProductoImagen, "base64")
      : Buffer.from([]);
    const query = `
      INSERT INTO "producto" (
        "ProductoCodigo",
        "ProductoNombre",
        "ProductoPrecioVenta",
        "ProductoPrecioVentaMayorista",
        "ProductoPrecioUnitario",
        "ProductoPrecioPromedio",
        "ProductoStock",
        "ProductoStockUnitario",
        "ProductoCantidadCaja",
        "ProductoIVA",
        "ProductoStockMinimo",
        "ProductoImagen",
        "ProductoImagen_GXI",
        "LocalId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING "ProductoId"
    `;
    const values = [
      productoData.ProductoCodigo,
      productoData.ProductoNombre,
      productoData.ProductoPrecioVenta,
      productoData.ProductoPrecioVentaMayorista,
      productoData.ProductoPrecioUnitario,
      productoData.ProductoPrecioPromedio,
      productoData.ProductoStock,
      productoData.ProductoStockUnitario,
      productoData.ProductoCantidadCaja,
      productoData.ProductoIVA,
      productoData.ProductoStockMinimo,
      imagenBuffer,
      productoData.ProductoImagen_GXI || null,
      productoData.LocalId,
    ];
    const result = await db.query(query, values);
    const productoId = result.rows[0].ProductoId;

    const productoAlmacen =
      productoData.productoAlmacen &&
      Array.isArray(productoData.productoAlmacen)
        ? productoData.productoAlmacen
        : [];

    if (productoAlmacen.length > 0) {
      let paramIndex = 1;
      const placeholders = productoAlmacen
        .map(() => {
          const ph = `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`;
          paramIndex += 4;
          return ph;
        })
        .join(", ");
      const insertValues = productoAlmacen.flatMap((pa) => [
        productoId,
        pa.AlmacenId,
        pa.ProductoAlmacenStock ?? 0,
        pa.ProductoAlmacenStockUnitario ?? 0,
      ]);
      await db.query(
        `INSERT INTO "productoalmacen" ("ProductoId", "AlmacenId", "ProductoAlmacenStock", "ProductoAlmacenStockUnitario") VALUES ${placeholders}`,
        insertValues
      );
    }

    return {
      ProductoId: productoId,
      ...productoData,
    };
  },

  update: async (id, productoData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    const camposActualizables = [
      "ProductoCodigo",
      "ProductoNombre",
      "ProductoPrecioVenta",
      "ProductoPrecioVentaMayorista",
      "ProductoPrecioUnitario",
      "ProductoPrecioPromedio",
      "ProductoStock",
      "ProductoStockUnitario",
      "ProductoCantidadCaja",
      "ProductoIVA",
      "ProductoStockMinimo",
      "ProductoImagen",
      "ProductoImagen_GXI",
      "LocalId",
    ];
    camposActualizables.forEach((campo) => {
      if (campo === "ProductoImagen_GXI") {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        values.push(productoData.ProductoImagen_GXI || null);
      } else if (campo === "ProductoImagen") {
        const imagenBuffer = productoData.ProductoImagen
          ? Buffer.from(productoData.ProductoImagen, "base64")
          : null;
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        values.push(imagenBuffer);
      } else if (productoData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        values.push(productoData[campo]);
      }
    });

    const productoAlmacen =
      productoData.productoAlmacen &&
      Array.isArray(productoData.productoAlmacen)
        ? productoData.productoAlmacen
        : undefined;

    const syncProductoAlmacen = async () => {
      // Si no se envia productoAlmacen desde el front, no tocamos el detalle.
      if (productoAlmacen === undefined) return;

      // Si se envia un array vacio, tampoco borramos filas para no violar FKs.
      if (productoAlmacen.length === 0) return;

      let paParamIndex = 1;
      const placeholders = productoAlmacen
        .map(() => {
          const ph = `($${paParamIndex}, $${paParamIndex + 1}, $${paParamIndex + 2}, $${paParamIndex + 3})`;
          paParamIndex += 4;
          return ph;
        })
        .join(", ");

      const insertValues = productoAlmacen.flatMap((pa) => [
        id,
        pa.AlmacenId,
        pa.ProductoAlmacenStock ?? 0,
        pa.ProductoAlmacenStockUnitario ?? 0,
      ]);

      // Usamos UPSERT para solo actualizar stock, sin borrar ni cambiar claves.
      const upsertQuery = `
        INSERT INTO "productoalmacen" (
          "ProductoId",
          "AlmacenId",
          "ProductoAlmacenStock",
          "ProductoAlmacenStockUnitario"
        ) VALUES ${placeholders}
        ON CONFLICT ("ProductoId", "AlmacenId") DO UPDATE SET
          "ProductoAlmacenStock" = EXCLUDED."ProductoAlmacenStock",
          "ProductoAlmacenStockUnitario" = EXCLUDED."ProductoAlmacenStockUnitario"
      `;

      await db.query(upsertQuery, insertValues);
    };

    if (updateFields.length === 0) {
      if (productoAlmacen === undefined) return null;
      await syncProductoAlmacen();
      const updated = await Producto.getById(id);
      return updated;
    }

    values.push(id);
    const query = `
      UPDATE "producto"
      SET ${updateFields.join(", ")}
      WHERE "ProductoId" = $${paramIndex}
    `;
    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return null;
    }
    await syncProductoAlmacen();
    const updated = await Producto.getById(id);
    return updated;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "producto" WHERE "ProductoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getReporteStock: async () => {
    const query = `
      SELECT
        p."ProductoId",
        p."ProductoCodigo",
        p."ProductoNombre",
        COALESCE(p."ProductoStock", 0) AS "ProductoStock",
        COALESCE(p."ProductoStockUnitario", 0) AS "ProductoStockUnitario",
        pa."AlmacenId",
        a."AlmacenNombre",
        COALESCE(pa."ProductoAlmacenStock", 0) AS "ProductoAlmacenStock",
        COALESCE(pa."ProductoAlmacenStockUnitario", 0) AS "ProductoAlmacenStockUnitario"
      FROM "producto" p
      LEFT JOIN "productoalmacen" pa ON p."ProductoId" = pa."ProductoId"
      LEFT JOIN "almacen" a ON pa."AlmacenId" = a."AlmacenId"
      ORDER BY p."ProductoCodigo", a."AlmacenNombre"
    `;
    const result = await db.query(query);
    const rows = result.rows;
    const byProduct = {};
    rows.forEach((row) => {
      const id = row.ProductoId;
      if (!byProduct[id]) {
        byProduct[id] = {
          ProductoId: row.ProductoId,
          ProductoCodigo: row.ProductoCodigo,
          ProductoNombre: row.ProductoNombre,
          // Usar directamente los valores de la tabla producto
          ProductoStock: Number(row.ProductoStock) || 0,
          ProductoStockUnitario: Number(row.ProductoStockUnitario) || 0,
          productoAlmacen: [],
        };
      }
      const totalStock = Number(row.ProductoAlmacenStock) || 0;
      const totalUnit = Number(row.ProductoAlmacenStockUnitario) || 0;
      if (row.AlmacenId != null) {
        byProduct[id].productoAlmacen.push({
          AlmacenNombre: row.AlmacenNombre || "",
          ProductoAlmacenStock: totalStock,
          ProductoAlmacenStockUnitario: totalUnit,
        });
      }
    });
    const productos = Object.values(byProduct);
    return { productos };
  },
};

module.exports = Producto;
