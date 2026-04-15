const db = require("../config/db");

const Nomina = {
  getAll: async () => {
    const result = await db.query(
      `SELECT n.*,
        c."ColegioNombre",
        cc."ColegioCursoNombre"
      FROM "nomina" n
      LEFT JOIN "colegio" c ON n."ColegioId" = c."ColegioId"
      LEFT JOIN "colegiocurso" cc ON n."ColegioId" = cc."ColegioId" AND n."ColegioCursoId" = cc."ColegioCursoId"`
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT n.*,
        c."ColegioNombre",
        cc."ColegioCursoNombre"
      FROM "nomina" n
      LEFT JOIN "colegio" c ON n."ColegioId" = c."ColegioId"
      LEFT JOIN "colegiocurso" cc ON n."ColegioId" = cc."ColegioId" AND n."ColegioCursoId" = cc."ColegioCursoId"
      WHERE n."NominaId" = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "NominaId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "NominaId",
      "NominaNombre",
      "NominaApellido",
      "ColegioId",
      "ColegioCursoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "NominaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const query = `
      SELECT n.*,
        c."ColegioNombre",
        cc."ColegioCursoNombre"
      FROM "nomina" n
      LEFT JOIN "colegio" c ON n."ColegioId" = c."ColegioId"
      LEFT JOIN "colegiocurso" cc ON n."ColegioId" = cc."ColegioId" AND n."ColegioCursoId" = cc."ColegioCursoId"
      ORDER BY n."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "nomina"'
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
    sortBy = "NominaId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "NominaId",
      "NominaNombre",
      "NominaApellido",
      "ColegioId",
      "ColegioCursoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "NominaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT n.*,
        c."ColegioNombre",
        cc."ColegioCursoNombre"
      FROM "nomina" n
      LEFT JOIN "colegio" c ON n."ColegioId" = c."ColegioId"
      LEFT JOIN "colegiocurso" cc ON n."ColegioId" = cc."ColegioId" AND n."ColegioCursoId" = cc."ColegioCursoId"
      WHERE n."NominaNombre" ILIKE $1
        OR n."NominaApellido" ILIKE $2
        OR CAST(n."NominaId" AS TEXT) ILIKE $3
        OR CAST(n."ColegioId" AS TEXT) ILIKE $4
        OR CAST(n."ColegioCursoId" AS TEXT) ILIKE $5
        OR c."ColegioNombre" ILIKE $6
        OR cc."ColegioCursoNombre" ILIKE $7
      ORDER BY n."${sortField}" ${order}
      LIMIT $8 OFFSET $9
    `;

    const result = await db.query(searchQuery, [
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      limit,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM "nomina" n
      LEFT JOIN "colegio" c ON n."ColegioId" = c."ColegioId"
      LEFT JOIN "colegiocurso" cc ON n."ColegioId" = cc."ColegioId" AND n."ColegioCursoId" = cc."ColegioCursoId"
      WHERE n."NominaNombre" ILIKE $1
        OR n."NominaApellido" ILIKE $2
        OR CAST(n."NominaId" AS TEXT) ILIKE $3
        OR CAST(n."ColegioId" AS TEXT) ILIKE $4
        OR CAST(n."ColegioCursoId" AS TEXT) ILIKE $5
        OR c."ColegioNombre" ILIKE $6
        OR cc."ColegioCursoNombre" ILIKE $7
    `;

    const countResult = await db.query(countQuery, [
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    ]);

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

  create: async (nominaData) => {
    const query = `
      INSERT INTO "nomina" (
        "NominaNombre",
        "NominaApellido",
        "ColegioId",
        "ColegioCursoId"
      ) VALUES ($1, $2, $3, $4)
      RETURNING "NominaId"
    `;

    const result = await db.query(query, [
      nominaData.NominaNombre,
      nominaData.NominaApellido,
      nominaData.ColegioId,
      nominaData.ColegioCursoId,
    ]);

    return Nomina.getById(result.rows[0].NominaId);
  },

  update: async (id, nominaData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "NominaNombre",
      "NominaApellido",
      "ColegioId",
      "ColegioCursoId",
    ];

    camposActualizables.forEach((campo) => {
      if (
        nominaData[campo] !== undefined &&
        nominaData[campo] !== null &&
        nominaData[campo] !== ""
      ) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        // Convertir a número si es ColegioId o ColegioCursoId
        if (campo === "ColegioId" || campo === "ColegioCursoId") {
          values.push(Number(nominaData[campo]));
        } else {
          values.push(nominaData[campo]);
        }
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      // Si no hay campos para actualizar, devolver la nomina actual sin cambios
      return Nomina.getById(id);
    }

    values.push(id);

    const query = `
      UPDATE "nomina"
      SET ${updateFields.join(", ")}
      WHERE "NominaId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    return Nomina.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "nomina" WHERE "NominaId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Nomina;
