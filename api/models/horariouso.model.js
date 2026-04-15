const db = require("../config/db");

const HorarioUso = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "horariouso"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "horariouso" WHERE "HorarioUsoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (horarioUsoData) => {
    const query = `INSERT INTO "horariouso" ("HorarioUsoDesde", "HorarioUsoHasta") VALUES ($1, $2) RETURNING "HorarioUsoId"`;
    const values = [
      horarioUsoData.HorarioUsoDesde,
      horarioUsoData.HorarioUsoHasta,
    ];
    const result = await db.query(query, values);
    // Obtener el horario recién creado
    return HorarioUso.getById(result.rows[0].HorarioUsoId);
  },

  update: async (id, horarioUsoData) => {
    const query = `UPDATE "horariouso" SET "HorarioUsoDesde" = $1, "HorarioUsoHasta" = $2 WHERE "HorarioUsoId" = $3`;
    const values = [
      horarioUsoData.HorarioUsoDesde,
      horarioUsoData.HorarioUsoHasta,
      id,
    ];
    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    return HorarioUso.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "horariouso" WHERE "HorarioUsoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getAllPaginated: async (limit, offset, sortBy = "HorarioUsoId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "HorarioUsoId",
      "HorarioUsoDesde",
      "HorarioUsoHasta",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "HorarioUsoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const result = await db.query(
      `SELECT * FROM "horariouso" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "horariouso"'
    );

    return {
      horarios: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchHorarios: async (
    term,
    limit,
    offset,
    sortBy = "HorarioUsoId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "HorarioUsoId",
      "HorarioUsoDesde",
      "HorarioUsoHasta",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "HorarioUsoId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT * FROM "horariouso"
      WHERE CAST("HorarioUsoId" AS TEXT) ILIKE $1
      OR TO_CHAR("HorarioUsoDesde", 'YYYY-MM-DD HH24:MI:SS') ILIKE $2
      OR TO_CHAR("HorarioUsoHasta", 'YYYY-MM-DD HH24:MI:SS') ILIKE $3
      ORDER BY "${sortField}" ${order}
      LIMIT $4 OFFSET $5
    `;

    const result = await db.query(searchQuery, [
      searchValue, searchValue, searchValue, limit, offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "horariouso"
      WHERE CAST("HorarioUsoId" AS TEXT) ILIKE $1
      OR TO_CHAR("HorarioUsoDesde", 'YYYY-MM-DD HH24:MI:SS') ILIKE $2
      OR TO_CHAR("HorarioUsoHasta", 'YYYY-MM-DD HH24:MI:SS') ILIKE $3
    `;

    const countResult = await db.query(countQuery, [
      searchValue, searchValue, searchValue,
    ]);

    return {
      horarios: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },
};

module.exports = HorarioUso;
