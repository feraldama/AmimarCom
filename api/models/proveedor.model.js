const db = require("../config/db");

const Proveedor = {
  getAll: async () => {
    const result = await db.query(
      'SELECT * FROM "proveedor" ORDER BY "ProveedorNombre" ASC'
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "proveedor" WHERE "ProveedorId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "ProveedorId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "ProveedorId",
      "ProveedorRUC",
      "ProveedorNombre",
      "ProveedorDireccion",
      "ProveedorTelefono",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ProveedorId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "proveedor" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "proveedor"'
    );

    return {
      proveedores: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (term, limit, offset, sortBy = "ProveedorId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ProveedorId",
      "ProveedorRUC",
      "ProveedorNombre",
      "ProveedorDireccion",
      "ProveedorTelefono",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ProveedorId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "proveedor"
        WHERE "ProveedorNombre" ILIKE $1
        OR "ProveedorRUC" ILIKE $2
        ORDER BY "${sortField}" ${order}
        LIMIT $3 OFFSET $4`,
      [searchValue, searchValue, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "proveedor"
        WHERE "ProveedorNombre" ILIKE $1
        OR "ProveedorRUC" ILIKE $2`,
      [searchValue, searchValue]
    );

    return {
      proveedores: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (proveedorData) => {
    const result = await db.query(
      `INSERT INTO "proveedor" (
          "ProveedorRUC",
          "ProveedorNombre",
          "ProveedorDireccion",
          "ProveedorTelefono"
        ) VALUES ($1, $2, $3, $4) RETURNING "ProveedorId"`,
      [
        proveedorData.ProveedorRUC || null,
        proveedorData.ProveedorNombre,
        proveedorData.ProveedorDireccion || null,
        proveedorData.ProveedorTelefono || null,
      ]
    );
    return {
      ProveedorId: result.rows[0].ProveedorId,
      ...proveedorData,
    };
  },

  update: async (id, proveedorData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    const camposActualizables = [
      "ProveedorRUC",
      "ProveedorNombre",
      "ProveedorDireccion",
      "ProveedorTelefono",
    ];

    camposActualizables.forEach((campo) => {
      if (proveedorData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(proveedorData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE "proveedor"
      SET ${updateFields.join(", ")}
      WHERE "ProveedorId" = $${paramIndex}
    `;

    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return null;
    }
    // Obtener el proveedor actualizado
    return Proveedor.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "proveedor" WHERE "ProveedorId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Proveedor;
