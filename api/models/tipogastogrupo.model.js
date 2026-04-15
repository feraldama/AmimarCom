const db = require("../config/db");

const TipoGastoGrupo = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "tipogastogrupo"');
    return result.rows;
  },

  getById: async (tipoGastoId, grupoId) => {
    const result = await db.query(
      'SELECT * FROM "tipogastogrupo" WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2',
      [tipoGastoId, grupoId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByTipoGastoId: async (tipoGastoId) => {
    const result = await db.query(
      'SELECT * FROM "tipogastogrupo" WHERE "TipoGastoId" = $1',
      [tipoGastoId]
    );
    return result.rows;
  },

  create: async (data) => {
    // 1. Obtener el contador actual
    const countResult = await db.query(
      'SELECT "TipoGastoCantGastos" FROM "tipogasto" WHERE "TipoGastoId" = $1',
      [data.TipoGastoId]
    );
    const nextGrupoId = (countResult.rows[0]?.TipoGastoCantGastos || 0) + 1;

    // 2. Insertar con el nuevo ID
    await db.query(
      'INSERT INTO "tipogastogrupo" ("TipoGastoId", "TipoGastoGrupoId", "TipoGastoGrupoDescripcion") VALUES ($1, $2, $3)',
      [data.TipoGastoId, nextGrupoId, data.TipoGastoGrupoDescripcion]
    );

    // 3. Actualizar el contador en TipoGasto
    await db.query(
      'UPDATE "tipogasto" SET "TipoGastoCantGastos" = $1 WHERE "TipoGastoId" = $2',
      [nextGrupoId, data.TipoGastoId]
    );

    const grupo = await TipoGastoGrupo.getById(data.TipoGastoId, nextGrupoId);
    return grupo;
  },

  update: async (id, data) => {
    // Primero verificar si hay registros dependientes
    const depResult = await db.query(
      'SELECT COUNT(*) as count FROM "cajagasto" WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2',
      [data.TipoGastoId, id]
    );

    if (depResult.rows[0].count > 0) {
      throw {
        message:
          "No se puede actualizar este grupo porque tiene gastos asociados en caja",
      };
    }

    // Si no hay dependencias, proceder con la actualizacion
    await db.query(
      'UPDATE "tipogastogrupo" SET "TipoGastoGrupoDescripcion" = $1 WHERE "TipoGastoGrupoId" = $2 AND "TipoGastoId" = $3',
      [data.TipoGastoGrupoDescripcion, id, data.TipoGastoId]
    );

    const grupo = await TipoGastoGrupo.getById(data.TipoGastoId, id);
    return grupo;
  },

  delete: async (tipoGastoId, grupoId) => {
    // Obtener el grupo antes de eliminarlo para saber el TipoGastoId
    const grupoResult = await db.query(
      'SELECT "TipoGastoId" FROM "tipogastogrupo" WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2',
      [tipoGastoId, grupoId]
    );
    const tipoGastoIdFound = grupoResult.rows[0]?.TipoGastoId;

    // Verificar si hay registros dependientes
    const depResult = await db.query(
      'SELECT COUNT(*) as count FROM "cajagasto" WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2',
      [tipoGastoId, grupoId]
    );

    if (depResult.rows[0].count > 0) {
      throw {
        message:
          "No se puede eliminar este grupo porque tiene gastos asociados en caja",
      };
    }

    // Si no hay dependencias, proceder con la eliminacion
    const deleteResult = await db.query(
      'DELETE FROM "tipogastogrupo" WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2',
      [tipoGastoId, grupoId]
    );

    if (tipoGastoIdFound) {
      await db.query(
        'UPDATE "tipogasto" SET "TipoGastoCantGastos" = "TipoGastoCantGastos" - 1 WHERE "TipoGastoId" = $1 AND "TipoGastoCantGastos" > 0',
        [tipoGastoIdFound]
      );
      return deleteResult.rowCount > 0 ? tipoGastoIdFound : false;
    } else {
      return deleteResult.rowCount > 0;
    }
  },
};

module.exports = TipoGastoGrupo;
