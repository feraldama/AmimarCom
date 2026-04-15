const db = require("../config/db");

const Cliente = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "clientes"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "clientes" WHERE "ClienteId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "ClienteId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ClienteId",
      "ClienteRUC",
      "ClienteNombre",
      "ClienteApellido",
      "ClienteDireccion",
      "ClienteTelefono",
      "ClienteTipo",
      "UsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ClienteId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "clientes" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "clientes"'
    );

    return {
      clientes: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (term, limit, offset, sortBy = "ClienteId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ClienteId",
      "ClienteRUC",
      "ClienteNombre",
      "ClienteApellido",
      "ClienteDireccion",
      "ClienteTelefono",
      "ClienteTipo",
      "UsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ClienteId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT * FROM "clientes"
      WHERE CONCAT("ClienteNombre", ' ', "ClienteApellido") ILIKE $1
      OR "ClienteRUC" ILIKE $2
      OR CAST("ClienteId" AS TEXT) ILIKE $3
      ORDER BY "${sortField}" ${order}
      LIMIT $4 OFFSET $5
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(searchQuery, [searchValue, searchValue, searchValue, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "clientes"
      WHERE CONCAT("ClienteNombre", ' ', "ClienteApellido") ILIKE $1
      OR "ClienteRUC" ILIKE $2
      OR CAST("ClienteId" AS TEXT) ILIKE $3
    `;

    const countResult = await db.query(countQuery, [searchValue, searchValue, searchValue]);

    return {
      clientes: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (clienteData) => {
    const query = `
      INSERT INTO "clientes" (
        "ClienteRUC",
        "ClienteNombre",
        "ClienteApellido",
        "ClienteDireccion",
        "ClienteTelefono",
        "ClienteTipo",
        "UsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "ClienteId"
    `;
    const values = [
      clienteData.ClienteRUC || "",
      clienteData.ClienteNombre,
      clienteData.ClienteApellido || "",
      clienteData.ClienteDireccion || "",
      clienteData.ClienteTelefono || "",
      clienteData.ClienteTipo || "",
      clienteData.UsuarioId ? String(clienteData.UsuarioId).trim() : "",
    ];
    const result = await db.query(query, values);
    return { ...clienteData, ClienteId: result.rows[0].ClienteId };
  },

  update: async (id, clienteData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;
    const camposActualizables = [
      "ClienteRUC",
      "ClienteNombre",
      "ClienteApellido",
      "ClienteDireccion",
      "ClienteTelefono",
      "ClienteTipo",
      "UsuarioId",
    ];
    camposActualizables.forEach((campo) => {
      if (clienteData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        // Aplicar trim solo al UsuarioId si es string
        if (campo === "UsuarioId" && typeof clienteData[campo] === "string") {
          values.push(clienteData[campo].trim());
        } else {
          values.push(clienteData[campo]);
        }
      }
    });
    if (updateFields.length === 0) {
      return null;
    }
    values.push(id);
    const query = `
      UPDATE "clientes"
      SET ${updateFields.join(", ")}
      WHERE "ClienteId" = $${paramIndex}
    `;
    const result = await db.query(query, values);
    if (result.rowCount === 0) {
      return null;
    }
    const updated = await db.query(
      'SELECT * FROM "clientes" WHERE "ClienteId" = $1',
      [id]
    );
    return updated.rows.length > 0 ? updated.rows[0] : null;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "clientes" WHERE "ClienteId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Cliente;
