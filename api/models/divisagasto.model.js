const db = require("../config/db");

const DivisaGasto = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "divisagasto"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "divisagasto" WHERE "DivisaGastoId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByDivisaId: async (divisaId) => {
    const result = await db.query(
      `SELECT dg.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
       FROM "divisagasto" dg
       LEFT JOIN "tipogasto" tg ON dg."TipoGastoId" = tg."TipoGastoId"
       LEFT JOIN "tipogastogrupo" tgg ON dg."TipoGastoId" = tgg."TipoGastoId" AND dg."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
       WHERE dg."DivisaId" = $1`,
      [divisaId]
    );
    return result.rows;
  },

  create: async (divisaGastoData) => {
    // Primero obtener el máximo DivisaGastoId para este DivisaId
    const maxResult = await db.query(
      'SELECT MAX("DivisaGastoId") as "maxId" FROM "divisagasto" WHERE "DivisaId" = $1',
      [divisaGastoData.DivisaId]
    );

    // Si no hay datos, empezar desde 1, sino usar el máximo + 1
    const nextId = (maxResult.rows[0]?.maxId || 0) + 1;

    const query = `
      INSERT INTO "divisagasto" (
        "DivisaId",
        "DivisaGastoId",
        "TipoGastoId",
        "TipoGastoGrupoId"
      ) VALUES ($1, $2, $3, $4)
    `;

    const values = [
      divisaGastoData.DivisaId,
      nextId,
      divisaGastoData.TipoGastoId,
      divisaGastoData.TipoGastoGrupoId,
    ];

    await db.query(query, values);

    // Obtener el registro recién creado usando DivisaId y DivisaGastoId
    const fetchResult = await db.query(
      'SELECT * FROM "divisagasto" WHERE "DivisaId" = $1 AND "DivisaGastoId" = $2',
      [divisaGastoData.DivisaId, nextId]
    );

    if (fetchResult.rows.length > 0) {
      return fetchResult.rows[0];
    } else {
      throw new Error("No se pudo obtener el registro creado");
    }
  },

  update: async (id, divisaGastoData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "DivisaId",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];

    camposActualizables.forEach((campo) => {
      if (divisaGastoData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        values.push(divisaGastoData[campo]);
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE "divisagasto"
      SET ${updateFields.join(", ")}
      WHERE "DivisaGastoId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const divisaGasto = await DivisaGasto.getById(id);
    return divisaGasto;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "divisagasto" WHERE "DivisaGastoId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  deleteByDivisaId: async (divisaId) => {
    const result = await db.query(
      'DELETE FROM "divisagasto" WHERE "DivisaId" = $1',
      [divisaId]
    );
    return result.rowCount > 0;
  },
};

module.exports = DivisaGasto;
