const db = require("../config/db");

const TipoGastoGrupo = {
  getAll: async () => {
    const result = await db.query(
      'SELECT * FROM "tipogastogrupo" ORDER BY "TipoGastoId", "TipoGastoGrupoId"'
    );
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
      'SELECT * FROM "tipogastogrupo" WHERE "TipoGastoId" = $1 ORDER BY "TipoGastoGrupoId"',
      [tipoGastoId]
    );
    return result.rows;
  },

  create: async (data) => {
    const descripcion = String(data.TipoGastoGrupoDescripcion || "")
      .trim()
      .toUpperCase();
    if (!descripcion) {
      throw new Error("La descripción del grupo es obligatoria");
    }

    const client = await db.connect();
    let nextGrupoId;
    try {
      await client.query("BEGIN");

      // Bloquea el tipo de gasto para que dos altas simultáneas no tomen el mismo ID
      const tipoResult = await client.query(
        'SELECT "TipoGastoId" FROM "tipogasto" WHERE "TipoGastoId" = $1 FOR UPDATE',
        [data.TipoGastoId]
      );
      if (tipoResult.rows.length === 0) {
        throw new Error("Tipo de gasto no encontrado");
      }

      // El próximo ID sale del máximo existente y no del contador
      // "TipoGastoCantGastos": el contador baja al eliminar y no contempla
      // grupos insertados por script, así que repetía IDs ya usados.
      const maxResult = await client.query(
        'SELECT COALESCE(MAX("TipoGastoGrupoId"), 0) + 1 AS next FROM "tipogastogrupo" WHERE "TipoGastoId" = $1',
        [data.TipoGastoId]
      );
      nextGrupoId = Number(maxResult.rows[0].next);

      await client.query(
        'INSERT INTO "tipogastogrupo" ("TipoGastoId", "TipoGastoGrupoId", "TipoGastoGrupoDescripcion") VALUES ($1, $2, $3)',
        [data.TipoGastoId, nextGrupoId, descripcion]
      );

      await client.query(
        'UPDATE "tipogasto" SET "TipoGastoCantGastos" = $1 WHERE "TipoGastoId" = $2',
        [nextGrupoId, data.TipoGastoId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return TipoGastoGrupo.getById(data.TipoGastoId, nextGrupoId);
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
