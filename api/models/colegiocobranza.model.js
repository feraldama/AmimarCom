const db = require("../config/db");

const ColegioCobranza = {
  getAll: async () => {
    const result = await db.query(
      `SELECT cc.*,
        c."CajaDescripcion",
        n."NominaNombre",
        n."NominaApellido",
        u."UsuarioNombre"
      FROM "colegiocobranza" cc
      LEFT JOIN "caja" c ON cc."CajaId" = c."CajaId"
      LEFT JOIN "nomina" n ON cc."NominaId" = n."NominaId"
      LEFT JOIN "usuario" u ON cc."UsuarioId" = u."UsuarioId"`
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT cc.*,
        c."CajaDescripcion",
        n."NominaNombre",
        n."NominaApellido",
        u."UsuarioNombre"
      FROM "colegiocobranza" cc
      LEFT JOIN "caja" c ON cc."CajaId" = c."CajaId"
      LEFT JOIN "nomina" n ON cc."NominaId" = n."NominaId"
      LEFT JOIN "usuario" u ON cc."UsuarioId" = u."UsuarioId"
      WHERE cc."ColegioCobranzaId" = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "ColegioCobranzaId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "ColegioCobranzaId",
      "CajaId",
      "ColegioCobranzaFecha",
      "NominaId",
      "ColegioCobranzaMesPagado",
      "ColegioCobranzaMes",
      "ColegioCobranzaDiasMora",
      "ColegioCobranzaExamen",
      "UsuarioId",
      "ColegioCobranzaDescuento",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioCobranzaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT cc.*,
        c."CajaDescripcion",
        n."NominaNombre",
        n."NominaApellido",
        u."UsuarioNombre"
      FROM "colegiocobranza" cc
      LEFT JOIN "caja" c ON cc."CajaId" = c."CajaId"
      LEFT JOIN "nomina" n ON cc."NominaId" = n."NominaId"
      LEFT JOIN "usuario" u ON cc."UsuarioId" = u."UsuarioId"
      ORDER BY cc."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "colegiocobranza"'
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
    sortBy = "ColegioCobranzaId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "ColegioCobranzaId",
      "CajaId",
      "ColegioCobranzaFecha",
      "NominaId",
      "ColegioCobranzaMesPagado",
      "ColegioCobranzaMes",
      "ColegioCobranzaDiasMora",
      "ColegioCobranzaExamen",
      "UsuarioId",
      "ColegioCobranzaDescuento",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioCobranzaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchQuery = `
      SELECT cc.*,
        c."CajaDescripcion",
        n."NominaNombre",
        n."NominaApellido",
        u."UsuarioNombre"
      FROM "colegiocobranza" cc
      LEFT JOIN "caja" c ON cc."CajaId" = c."CajaId"
      LEFT JOIN "nomina" n ON cc."NominaId" = n."NominaId"
      LEFT JOIN "usuario" u ON cc."UsuarioId" = u."UsuarioId"
      WHERE CAST(cc."ColegioCobranzaId" AS TEXT) ILIKE $1
        OR CAST(cc."CajaId" AS TEXT) ILIKE $2
        OR cc."ColegioCobranzaFecha"::TEXT ILIKE $3
        OR CAST(cc."NominaId" AS TEXT) ILIKE $4
        OR cc."ColegioCobranzaMesPagado" ILIKE $5
        OR cc."ColegioCobranzaMes" ILIKE $6
        OR CAST(cc."ColegioCobranzaDiasMora" AS TEXT) ILIKE $7
        OR cc."ColegioCobranzaExamen" ILIKE $8
        OR CAST(cc."UsuarioId" AS TEXT) ILIKE $9
        OR CAST(cc."ColegioCobranzaDescuento" AS TEXT) ILIKE $10
        OR c."CajaDescripcion" ILIKE $11
        OR n."NominaNombre" ILIKE $12
        OR n."NominaApellido" ILIKE $13
        OR u."UsuarioNombre" ILIKE $14
      ORDER BY cc."${sortField}" ${order}
      LIMIT $15 OFFSET $16
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
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        limit,
        offset,
      ]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total
      FROM "colegiocobranza" cc
      LEFT JOIN "caja" c ON cc."CajaId" = c."CajaId"
      LEFT JOIN "nomina" n ON cc."NominaId" = n."NominaId"
      LEFT JOIN "usuario" u ON cc."UsuarioId" = u."UsuarioId"
      WHERE CAST(cc."ColegioCobranzaId" AS TEXT) ILIKE $1
        OR CAST(cc."CajaId" AS TEXT) ILIKE $2
        OR cc."ColegioCobranzaFecha"::TEXT ILIKE $3
        OR CAST(cc."NominaId" AS TEXT) ILIKE $4
        OR cc."ColegioCobranzaMesPagado" ILIKE $5
        OR cc."ColegioCobranzaMes" ILIKE $6
        OR CAST(cc."ColegioCobranzaDiasMora" AS TEXT) ILIKE $7
        OR cc."ColegioCobranzaExamen" ILIKE $8
        OR CAST(cc."UsuarioId" AS TEXT) ILIKE $9
        OR CAST(cc."ColegioCobranzaDescuento" AS TEXT) ILIKE $10
        OR c."CajaDescripcion" ILIKE $11
        OR n."NominaNombre" ILIKE $12
        OR n."NominaApellido" ILIKE $13
        OR u."UsuarioNombre" ILIKE $14`,
      [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
      ]
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

  create: async (cobranzaData) => {
    const query = `
      INSERT INTO "colegiocobranza" (
        "CajaId",
        "ColegioCobranzaFecha",
        "NominaId",
        "ColegioCobranzaMesPagado",
        "ColegioCobranzaMes",
        "ColegioCobranzaDiasMora",
        "ColegioCobranzaExamen",
        "UsuarioId",
        "ColegioCobranzaDescuento"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING "ColegioCobranzaId"
    `;

    const result = await db.query(
      query,
      [
        cobranzaData.CajaId,
        cobranzaData.ColegioCobranzaFecha,
        cobranzaData.NominaId,
        cobranzaData.ColegioCobranzaMesPagado,
        cobranzaData.ColegioCobranzaMes,
        cobranzaData.ColegioCobranzaDiasMora,
        cobranzaData.ColegioCobranzaExamen,
        cobranzaData.UsuarioId,
        cobranzaData.ColegioCobranzaDescuento,
      ]
    );

    const cobranza = await ColegioCobranza.getById(result.rows[0].ColegioCobranzaId);
    return cobranza;
  },

  update: async (id, cobranzaData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaId",
      "ColegioCobranzaFecha",
      "NominaId",
      "ColegioCobranzaMesPagado",
      "ColegioCobranzaMes",
      "ColegioCobranzaDiasMora",
      "ColegioCobranzaExamen",
      "UsuarioId",
      "ColegioCobranzaDescuento",
    ];

    camposActualizables.forEach((campo) => {
      if (
        cobranzaData[campo] !== undefined &&
        cobranzaData[campo] !== null &&
        cobranzaData[campo] !== ""
      ) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        // Convertir a número si es necesario
        if (
          campo === "CajaId" ||
          campo === "NominaId" ||
          campo === "UsuarioId" ||
          campo === "ColegioCobranzaDiasMora"
        ) {
          values.push(Number(cobranzaData[campo]));
        } else if (campo === "ColegioCobranzaDescuento") {
          values.push(Number(cobranzaData[campo]) || 0);
        } else {
          values.push(cobranzaData[campo]);
        }
      }
    });

    if (updateFields.length === 0) {
      // Si no hay campos para actualizar, devolver la cobranza actual sin cambios
      const cobranza = await ColegioCobranza.getById(id);
      return cobranza;
    }

    values.push(id);

    const query = `
      UPDATE "colegiocobranza"
      SET ${updateFields.join(", ")}
      WHERE "ColegioCobranzaId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const cobranza = await ColegioCobranza.getById(id);
    return cobranza;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "colegiocobranza" WHERE "ColegioCobranzaId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = ColegioCobranza;
