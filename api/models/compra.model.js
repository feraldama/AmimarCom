const db = require("../config/db");

const Compra = {
  getAll: async () => {
    const result = await db.query(
      `SELECT c.*, p."ProveedorNombre", p."ProveedorRUC",
       COALESCE(SUM(cp."CompraProductoPrecio" * cp."CompraProductoCantidad"), 0) as "Total",
       (SELECT "AlmacenOrigenId" FROM "compraproducto" WHERE "CompraId" = c."CompraId" LIMIT 1) as "AlmacenId"
       FROM "compra" c
       LEFT JOIN "proveedor" p ON c."ProveedorId" = p."ProveedorId"
       LEFT JOIN "compraproducto" cp ON c."CompraId" = cp."CompraId"
       GROUP BY c."CompraId", p."ProveedorNombre", p."ProveedorRUC"
       ORDER BY c."CompraFecha" DESC`
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT c.*, p."ProveedorNombre", p."ProveedorRUC",
       COALESCE(SUM(cp."CompraProductoPrecio" * cp."CompraProductoCantidad"), 0) as "Total",
       (SELECT "AlmacenOrigenId" FROM "compraproducto" WHERE "CompraId" = c."CompraId" LIMIT 1) as "AlmacenId"
       FROM "compra" c
       LEFT JOIN "proveedor" p ON c."ProveedorId" = p."ProveedorId"
       LEFT JOIN "compraproducto" cp ON c."CompraId" = cp."CompraId"
       WHERE c."CompraId" = $1
       GROUP BY c."CompraId", p."ProveedorNombre", p."ProveedorRUC"`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "CompraId",
    sortOrder = "DESC",
    filters = {}
  ) => {
    const allowedSortFields = [
      "CompraId",
      "CompraFecha",
      "ProveedorId",
      "UsuarioId",
      "CompraFactura",
      "CompraTipo",
      "CompraPagoCompleto",
      "CompraEntrega",
      "ProveedorNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CompraId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const orderByField = sortField === "Total"
      ? '"Total"'
      : sortField === "ProveedorNombre"
        ? `p."${sortField}"`
        : `c."${sortField}"`;

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, proveedorId, compraTipo } = filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`c."CompraFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`c."CompraFecha"::date <= $${params.length}::date`);
    }
    if (proveedorId) {
      params.push(proveedorId);
      conditions.push(`c."ProveedorId" = $${params.length}`);
    }
    if (compraTipo) {
      params.push(compraTipo);
      conditions.push(`c."CompraTipo" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query(
      `SELECT c.*, p."ProveedorNombre", p."ProveedorRUC",
       COALESCE(SUM(cp."CompraProductoPrecio" * cp."CompraProductoCantidad"), 0) as "Total",
       (SELECT "AlmacenOrigenId" FROM "compraproducto" WHERE "CompraId" = c."CompraId" LIMIT 1) as "AlmacenId"
       FROM "compra" c
       LEFT JOIN "proveedor" p ON c."ProveedorId" = p."ProveedorId"
       LEFT JOIN "compraproducto" cp ON c."CompraId" = cp."CompraId"
       ${where}
       GROUP BY c."CompraId", p."ProveedorNombre", p."ProveedorRUC"
       ORDER BY ${orderByField} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "compra" c ${where}`,
      params
    );

    return {
      compras: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (
    term,
    limit,
    offset,
    sortBy = "CompraId",
    sortOrder = "DESC",
    filters = {}
  ) => {
    const allowedSortFields = [
      "CompraId",
      "CompraFecha",
      "ProveedorId",
      "UsuarioId",
      "CompraFactura",
      "CompraTipo",
      "CompraPagoCompleto",
      "CompraEntrega",
      "ProveedorNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "CompraId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const orderByField = sortField === "Total"
      ? '"Total"'
      : sortField === "ProveedorNombre"
        ? `p."${sortField}"`
        : `c."${sortField}"`;

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        c."CompraFactura" ILIKE $1
        OR c."CompraTipo" ILIKE $1
        OR p."ProveedorNombre" ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, proveedorId, compraTipo } = filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`c."CompraFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`c."CompraFecha"::date <= $${params.length}::date`);
    }
    if (proveedorId) {
      params.push(proveedorId);
      conditions.push(`c."ProveedorId" = $${params.length}`);
    }
    if (compraTipo) {
      params.push(compraTipo);
      conditions.push(`c."CompraTipo" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT c.*, p."ProveedorNombre", p."ProveedorRUC",
      COALESCE(SUM(cp."CompraProductoPrecio" * cp."CompraProductoCantidad"), 0) as "Total",
      (SELECT "AlmacenOrigenId" FROM "compraproducto" WHERE "CompraId" = c."CompraId" LIMIT 1) as "AlmacenId"
      FROM "compra" c
      LEFT JOIN "proveedor" p ON c."ProveedorId" = p."ProveedorId"
      LEFT JOIN "compraproducto" cp ON c."CompraId" = cp."CompraId"
      ${where}
      GROUP BY c."CompraId", p."ProveedorNombre", p."ProveedorRUC"
      ORDER BY ${orderByField} ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "compra" c
      LEFT JOIN "proveedor" p ON c."ProveedorId" = p."ProveedorId"
      ${where}
    `;

    const countResult = await db.query(countQuery, params);

    return {
      compras: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (compraData) => {
    const query = `
      INSERT INTO "compra" (
        "CompraFecha",
        "ProveedorId",
        "UsuarioId",
        "CompraFactura",
        "CompraTipo",
        "CompraPagoCompleto",
        "CompraEntrega"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "CompraId"
    `;
    const values = [
      compraData.CompraFecha || new Date(),
      compraData.ProveedorId,
      compraData.UsuarioId,
      compraData.CompraFactura,
      compraData.CompraTipo,
      compraData.CompraPagoCompleto || false,
      compraData.CompraEntrega,
    ];

    const result = await db.query(query, values);
    return {
      CompraId: result.rows[0].CompraId,
      ...compraData,
    };
  },

  update: async (id, compraData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    const camposActualizables = [
      "ProveedorId",
      "CompraFactura",
      "CompraTipo",
      "CompraPagoCompleto",
      "CompraEntrega",
    ];

    camposActualizables.forEach((campo) => {
      if (compraData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        values.push(compraData[campo]);
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE "compra"
      SET ${updateFields.join(", ")}
      WHERE "CompraId" = $${paramIndex}
    `;

    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return null;
    }
    // Obtener la compra actualizada
    const updated = await Compra.getById(id);
    return updated;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "compra" WHERE "CompraId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Compra;
