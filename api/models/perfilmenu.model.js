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
    // Con varios perfiles sobre el mismo menú, cada acción queda permitida si
    // algún perfil la permite (OR), sin depender del orden de las filas.
    const permisos = {};
    result.rows.forEach((row) => {
      const actual = permisos[row.MenuNombre] || {};
      permisos[row.MenuNombre] = {
        crear: !!actual.crear || !!row.puedeCrear,
        editar: !!actual.editar || !!row.puedeEditar,
        eliminar: !!actual.eliminar || !!row.puedeEliminar,
        leer: !!actual.leer || !!row.puedeLeer,
      };
    });
    return permisos;
  },

  // `client` permite ejecutar el insert dentro de una transacción.
  create: async (data, client = db) => {
    await client.query(
      'INSERT INTO "perfilmenu" ("PerfilId", "MenuId", "puedeCrear", "puedeEditar", "puedeEliminar", "puedeLeer") VALUES ($1, $2, $3, $4, $5, $6)',
      [
        data.PerfilId,
        data.MenuId,
        data.puedeCrear,
        data.puedeEditar,
        data.puedeEliminar,
        data.puedeLeer,
      ]
    );
    return { ...data };
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
