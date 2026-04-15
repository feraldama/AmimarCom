const db = require("../config/db");

const PerfilMenu = {
  getByPerfil: async (perfilId) => {
    const result = await db.query(
      'SELECT * FROM "perfilmenu" WHERE "PerfilId" = $1',
      [perfilId]
    );
    return result.rows;
  },

  getPermisosByUsuarioId: async (usuarioId) => {
    const query = `
      SELECT m."MenuNombre", pm."puedeCrear", pm."puedeEditar", pm."puedeEliminar", pm."puedeLeer"
      FROM "usuarioperfil" up
      JOIN "perfilmenu" pm ON up."PerfilId" = pm."PerfilId"
      JOIN "menu" m ON pm."MenuId" = m."MenuId"
      WHERE up."UsuarioId" = $1
    `;
    const result = await db.query(query, [usuarioId]);
    const permisos = {};
    result.rows.forEach((row) => {
      permisos[row.MenuNombre] = {
        crear: !!row.puedeCrear,
        editar: !!row.puedeEditar,
        eliminar: !!row.puedeEliminar,
        leer: !!row.puedeLeer,
      };
    });
    return permisos;
  },

  create: async (data) => {
    const result = await db.query(
      'INSERT INTO "perfilmenu" ("PerfilId", "MenuId", "puedeCrear", "puedeEditar", "puedeEliminar", "puedeLeer") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "PerfilMenuId"',
      [
        data.PerfilId,
        data.MenuId,
        data.puedeCrear,
        data.puedeEditar,
        data.puedeEliminar,
        data.puedeLeer,
      ]
    );
    return { PerfilMenuId: result.rows[0].PerfilMenuId, ...data };
  },

  update: async (perfilId, menuId, data) => {
    await db.query(
      'UPDATE "perfilmenu" SET "puedeCrear"=$1, "puedeEditar"=$2, "puedeEliminar"=$3, "puedeLeer"=$4 WHERE "PerfilId"=$5 AND "MenuId"=$6',
      [
        data.puedeCrear,
        data.puedeEditar,
        data.puedeEliminar,
        data.puedeLeer,
        perfilId,
        menuId,
      ]
    );
  },

  delete: async (perfilId, menuId) => {
    await db.query(
      'DELETE FROM "perfilmenu" WHERE "PerfilId"=$1 AND "MenuId"=$2',
      [perfilId, menuId]
    );
  },
};

module.exports = PerfilMenu;
