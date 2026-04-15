const db = require("../config/db");

const ColegioCurso = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "colegiocurso"');
    return result.rows;
  },

  getById: async (colegioId, cursoId) => {
    const result = await db.query(
      'SELECT * FROM "colegiocurso" WHERE "ColegioId" = $1 AND "ColegioCursoId" = $2',
      [colegioId, cursoId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByColegioId: async (colegioId) => {
    const result = await db.query(
      'SELECT * FROM "colegiocurso" WHERE "ColegioId" = $1',
      [colegioId]
    );
    return result.rows;
  },

  create: async (cursoData) => {
    // Primero obtener el máximo ColegioCursoId para este ColegioId
    const maxResult = await db.query(
      'SELECT MAX("ColegioCursoId") as "maxId" FROM "colegiocurso" WHERE "ColegioId" = $1',
      [cursoData.ColegioId]
    );

    const nextId = (maxResult.rows[0]?.maxId || 0) + 1;

    const query = `
      INSERT INTO "colegiocurso" (
        "ColegioId",
        "ColegioCursoId",
        "ColegioCursoNombre",
        "ColegioCursoImporte"
      ) VALUES ($1, $2, $3, $4)
    `;

    const values = [
      cursoData.ColegioId,
      nextId,
      cursoData.ColegioCursoNombre,
      cursoData.ColegioCursoImporte || 0,
    ];

    await db.query(query, values);

    // Incrementar ColegioCantCurso en la tabla colegio
    try {
      await db.query(
        'UPDATE "colegio" SET "ColegioCantCurso" = "ColegioCantCurso" + 1 WHERE "ColegioId" = $1',
        [cursoData.ColegioId]
      );
    } catch (err) {
      console.error("Error al actualizar ColegioCantCurso:", err);
      // No lanzamos el error porque el curso ya se creó
    }

    // Obtener el registro recién creado
    const curso = await ColegioCurso.getById(cursoData.ColegioId, nextId);
    return curso;
  },

  update: async (colegioId, cursoId, cursoData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = ["ColegioCursoNombre", "ColegioCursoImporte"];

    camposActualizables.forEach((campo) => {
      if (cursoData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        values.push(cursoData[campo]);
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(colegioId, cursoId);

    const query = `
      UPDATE "colegiocurso"
      SET ${updateFields.join(", ")}
      WHERE "ColegioId" = $${paramIndex} AND "ColegioCursoId" = $${paramIndex + 1}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const curso = await ColegioCurso.getById(colegioId, cursoId);
    return curso;
  },

  delete: async (colegioId, cursoId) => {
    const result = await db.query(
      'DELETE FROM "colegiocurso" WHERE "ColegioId" = $1 AND "ColegioCursoId" = $2',
      [colegioId, cursoId]
    );

    if (result.rowCount > 0) {
      // Decrementar ColegioCantCurso en la tabla colegio
      try {
        await db.query(
          'UPDATE "colegio" SET "ColegioCantCurso" = GREATEST("ColegioCantCurso" - 1, 0) WHERE "ColegioId" = $1',
          [colegioId]
        );
      } catch (err) {
        console.error("Error al actualizar ColegioCantCurso:", err);
        // No lanzamos el error porque el curso ya se eliminó
      }
      return true;
    } else {
      return false;
    }
  },
};

module.exports = ColegioCurso;
