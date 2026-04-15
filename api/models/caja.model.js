const db = require("../config/db");

const Caja = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "caja"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (cajaData) => {
    const result = await db.query(
      'INSERT INTO "caja" ("CajaDescripcion", "CajaMonto", "CajaGastoCantidad", "CajaTipoId") VALUES ($1, $2, $3, $4) RETURNING "CajaId"',
      [cajaData.CajaDescripcion, cajaData.CajaMonto, cajaData.CajaGastoCantidad || 0, cajaData.CajaTipoId || 1]
    );
    return Caja.getById(result.rows[0].CajaId);
  },

  update: async (id, cajaData) => {
    const result = await db.query(
      'UPDATE "caja" SET "CajaDescripcion" = $1, "CajaMonto" = $2, "CajaGastoCantidad" = $3, "CajaTipoId" = $4 WHERE "CajaId" = $5',
      [cajaData.CajaDescripcion, cajaData.CajaMonto, cajaData.CajaGastoCantidad || 0, cajaData.CajaTipoId || 1, id]
    );
    if (result.rowCount === 0) return null;
    return Caja.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "caja" WHERE "CajaId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "CajaId", sortOrder = "ASC", cajaTipoId = null) => {
    const allowedSortFields = ["CajaId", "CajaDescripcion", "CajaMonto"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "CajaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const params = [];
    let whereClause = "";
    if (cajaTipoId !== null) {
      params.push(cajaTipoId);
      whereClause = `WHERE "CajaTipoId" = $${params.length}`;
    }

    const result = await db.query(
      `SELECT * FROM "caja" ${whereClause} ORDER BY "${sortField}" ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "caja" ${whereClause}`,
      params
    );

    return {
      cajas: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchCajas: async (term, limit, offset, sortBy = "CajaId", sortOrder = "ASC", cajaTipoId = null) => {
    const allowedSortFields = ["CajaId", "CajaDescripcion", "CajaMonto"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "CajaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;
    const params = [searchValue, searchValue];
    let tipoFilter = "";
    if (cajaTipoId !== null) {
      params.push(cajaTipoId);
      tipoFilter = `AND "CajaTipoId" = $${params.length}`;
    }

    const result = await db.query(
      `SELECT * FROM "caja"
        WHERE ("CajaDescripcion" ILIKE $1
        OR CAST("CajaMonto" AS TEXT) ILIKE $2)
        ${tipoFilter}
        ORDER BY "${sortField}" ${order}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "caja"
        WHERE ("CajaDescripcion" ILIKE $1
        OR CAST("CajaMonto" AS TEXT) ILIKE $2)
        ${tipoFilter}`,
      params
    );

    return {
      cajas: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = Caja;
