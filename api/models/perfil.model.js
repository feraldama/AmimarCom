const db = require("../config/db");

const Perfil = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "perfil"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "perfil" WHERE "PerfilId" = $1',
      [id]
    );
    return result.rows[0];
  },

  create: async (data) => {
    const result = await db.query(
      'INSERT INTO "perfil" ("PerfilDescripcion") VALUES ($1) RETURNING "PerfilId"',
      [data.PerfilDescripcion]
    );
    return { PerfilId: result.rows[0].PerfilId, ...data };
  },

  update: async (id, data) => {
    await db.query(
      'UPDATE "perfil" SET "PerfilDescripcion" = $1 WHERE "PerfilId" = $2',
      [data.PerfilDescripcion, id]
    );
    return { PerfilId: id, ...data };
  },

  delete: async (id) => {
    await db.query('DELETE FROM "perfil" WHERE "PerfilId" = $1', [id]);
  },

  getAllPaginated: async (page = 1, itemsPerPage = 10) => {
    const offset = (page - 1) * itemsPerPage;

    const result = await db.query(
      'SELECT * FROM "perfil" LIMIT $1 OFFSET $2',
      [parseInt(itemsPerPage), parseInt(offset)]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "perfil"'
    );

    const total = countResult.rows[0].total;

    return {
      data: result.rows,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / itemsPerPage),
        currentPage: page,
        itemsPerPage: itemsPerPage,
      },
    };
  },
};

module.exports = Perfil;
