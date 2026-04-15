const db = require("../config/db");

const Colegio = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "colegio"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "colegio" WHERE "ColegioId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "ColegioId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ColegioId",
      "ColegioNombre",
      "ColegioCantCurso",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const query = `
      SELECT c.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "colegio" c
      LEFT JOIN "tipogasto" tg ON c."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON c."TipoGastoId" = tgg."TipoGastoId" AND c."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      ORDER BY c."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "colegio"'
    );

    return {
      data: result.rows,
      pagination: {
        totalItems: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
        currentPage: Math.floor(offset / limit) + 1,
        itemsPerPage: limit,
      },
    };
  },

  search: async (
    term,
    limit,
    offset,
    sortBy = "ColegioId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "ColegioId",
      "ColegioNombre",
      "ColegioCantCurso",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT c.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "colegio" c
      LEFT JOIN "tipogasto" tg ON c."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON c."TipoGastoId" = tgg."TipoGastoId" AND c."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      WHERE c."ColegioNombre" ILIKE $1
        OR CAST(c."ColegioId" AS TEXT) ILIKE $2
        OR CAST(c."ColegioCantCurso" AS TEXT) ILIKE $3
        OR CAST(c."TipoGastoId" AS TEXT) ILIKE $4
        OR CAST(c."TipoGastoGrupoId" AS TEXT) ILIKE $5
      ORDER BY c."${sortField}" ${order}
      LIMIT $6 OFFSET $7
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(
      searchQuery,
      [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        limit,
        offset,
      ]
    );

    const countQuery = `
      SELECT COUNT(*) as total FROM "colegio"
      WHERE "ColegioNombre" ILIKE $1
        OR CAST("ColegioId" AS TEXT) ILIKE $2
        OR CAST("ColegioCantCurso" AS TEXT) ILIKE $3
        OR CAST("TipoGastoId" AS TEXT) ILIKE $4
        OR CAST("TipoGastoGrupoId" AS TEXT) ILIKE $5
    `;

    const countResult = await db.query(
      countQuery,
      [searchValue, searchValue, searchValue, searchValue, searchValue]
    );

    const total = countResult.rows[0]?.total || 0;

    return {
      data: result.rows,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
        itemsPerPage: limit,
      },
    };
  },

  create: async (colegioData) => {
    const query = `
      INSERT INTO "colegio" (
        "ColegioNombre",
        "ColegioCantCurso",
        "TipoGastoId",
        "TipoGastoGrupoId"
      ) VALUES ($1, $2, $3, $4) RETURNING "ColegioId"
    `;

    const values = [
      colegioData.ColegioNombre,
      colegioData.ColegioCantCurso || 0,
      colegioData.TipoGastoId,
      colegioData.TipoGastoGrupoId,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    const colegio = await Colegio.getById(result.rows[0].ColegioId);
    return colegio;
  },

  update: async (id, colegioData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    // Campos editables por el usuario (excluir ColegioCantCurso que se actualiza automáticamente)
    const camposActualizables = [
      "ColegioNombre",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];

    camposActualizables.forEach((campo) => {
      if (
        colegioData[campo] !== undefined &&
        colegioData[campo] !== null &&
        colegioData[campo] !== ""
      ) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        // Convertir a número si es TipoGastoId o TipoGastoGrupoId
        if (campo === "TipoGastoId" || campo === "TipoGastoGrupoId") {
          values.push(Number(colegioData[campo]));
        } else {
          values.push(colegioData[campo]);
        }
      }
    });

    if (updateFields.length === 0) {
      // Si no hay campos para actualizar, devolver el colegio actual sin cambios
      const colegio = await Colegio.getById(id);
      return colegio;
    }

    values.push(id);

    const query = `
      UPDATE "colegio"
      SET ${updateFields.join(", ")}
      WHERE "ColegioId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const colegio = await Colegio.getById(id);
    return colegio;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "colegio" WHERE "ColegioId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Colegio;
