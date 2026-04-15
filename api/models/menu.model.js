const db = require("../config/db");

const Menu = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "menu"');
    return result.rows;
  },

  getAllPaginated: async (
    page = 1,
    itemsPerPage = 10,
    sortBy = "MenuId",
    sortOrder = "ASC",
    search = ""
  ) => {
    const offset = (page - 1) * itemsPerPage;
    const allowedSortFields = ["MenuId", "MenuNombre"];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "MenuId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    let where = "";
    let params = [];
    let paramIndex = 1;

    if (search) {
      where = `WHERE "MenuId" ILIKE $${paramIndex} OR "MenuNombre" ILIKE $${paramIndex + 1}`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    params.push(parseInt(itemsPerPage), parseInt(offset));

    const query = `
      SELECT * FROM "menu"
      ${where}
      ORDER BY "${sortField}" ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await db.query(query, params);

    let countParams = [];
    let countWhere = "";
    if (search) {
      countWhere = `WHERE "MenuId" ILIKE $1 OR "MenuNombre" ILIKE $2`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "menu" ${countWhere}`,
      countParams
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

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "menu" WHERE "MenuId" = $1',
      [id]
    );
    return result.rows[0];
  },

  create: async (data) => {
    await db.query(
      'INSERT INTO "menu" ("MenuId", "MenuNombre") VALUES ($1, $2)',
      [data.MenuId, data.MenuNombre]
    );
    return { MenuId: data.MenuId, ...data };
  },

  update: async (id, data) => {
    await db.query(
      'UPDATE "menu" SET "MenuNombre" = $1 WHERE "MenuId" = $2',
      [data.MenuNombre, id]
    );
    return { MenuId: id, ...data };
  },

  delete: async (id) => {
    await db.query('DELETE FROM "menu" WHERE "MenuId" = $1', [id]);
  },
};

module.exports = Menu;
