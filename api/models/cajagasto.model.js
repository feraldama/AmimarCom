const db = require("../config/db");

const CajaGasto = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "cajagasto"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "cajagasto" WHERE "CajaGastoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByCajaId: async (cajaId) => {
    const result = await db.query(
      `SELECT cg.*, tg."TipoGastoDescripcion", tgg."TipoGastoGrupoDescripcion"
       FROM "cajagasto" cg
       LEFT JOIN "tipogasto" tg ON cg."TipoGastoId" = tg."TipoGastoId"
       LEFT JOIN "tipogastogrupo" tgg ON cg."TipoGastoId" = tgg."TipoGastoId" AND cg."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
       WHERE cg."CajaId" = $1`,
      [cajaId]
    );
    return result.rows;
  },

  getByTipoGastoAndGrupo: async (tipoGastoId, tipoGastoGrupoId) => {
    const result = await db.query(
      `SELECT cg.*, tg."TipoGastoDescripcion", tgg."TipoGastoGrupoDescripcion"
       FROM "cajagasto" cg
       LEFT JOIN "tipogasto" tg ON cg."TipoGastoId" = tg."TipoGastoId"
       LEFT JOIN "tipogastogrupo" tgg ON cg."TipoGastoId" = tgg."TipoGastoId" AND cg."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
       WHERE cg."TipoGastoId" = $1 AND cg."TipoGastoGrupoId" = $2`,
      [tipoGastoId, tipoGastoGrupoId]
    );
    return result.rows;
  },

  create: async (data) => {
    // Obtener el siguiente CajaGastoId disponible para la caja
    const maxResult = await db.query(
      'SELECT MAX("CajaGastoId") as "maxId" FROM "cajagasto" WHERE "CajaId" = $1',
      [data.CajaId]
    );
    const nextId = (maxResult.rows[0]?.maxId || 0) + 1;

    const query = `INSERT INTO "cajagasto" ("CajaId", "CajaGastoId", "TipoGastoId", "TipoGastoGrupoId") VALUES ($1, $2, $3, $4)`;
    const values = [
      data.CajaId,
      nextId,
      data.TipoGastoId,
      data.TipoGastoGrupoId,
    ];
    await db.query(query, values);

    const gasto = await CajaGasto.getById(nextId);
    return gasto;
  },

  update: async (id, data) => {
    const query = `UPDATE "cajagasto" SET "CajaId" = $1, "TipoGastoId" = $2, "TipoGastoGrupoId" = $3 WHERE "CajaGastoId" = $4`;
    const values = [data.CajaId, data.TipoGastoId, data.TipoGastoGrupoId, id];
    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    const gasto = await CajaGasto.getById(id);
    return gasto;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "cajagasto" WHERE "CajaGastoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = CajaGasto;
