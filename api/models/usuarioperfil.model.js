const db = require("../config/db");

const UsuarioPerfil = {
  getByUsuario: async (usuarioId) => {
    const result = await db.query(
      'SELECT * FROM "usuarioperfil" WHERE "UsuarioId" = $1',
      [usuarioId]
    );
    return result.rows;
  },

  create: async (data) => {
    await db.query(
      'INSERT INTO "usuarioperfil" ("UsuarioId", "PerfilId") VALUES ($1, $2)',
      [data.UsuarioId, data.PerfilId]
    );
    return { UsuarioId: data.UsuarioId, PerfilId: data.PerfilId };
  },

  delete: async (usuarioId, perfilId) => {
    await db.query(
      'DELETE FROM "usuarioperfil" WHERE "UsuarioId"=$1 AND "PerfilId"=$2',
      [usuarioId, perfilId]
    );
  },
};

module.exports = UsuarioPerfil;
