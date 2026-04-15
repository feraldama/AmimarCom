const db = require("../config/db");

const Transporte = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "transporte"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "transporte" WHERE "TransporteId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "TransporteId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "TransporteId",
      "TransporteNombre",
      "TransporteTelefono",
      "TransporteDireccion",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "TransporteComision",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "TransporteId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT t.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "transporte" t
      LEFT JOIN "tipogasto" tg ON t."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON t."TipoGastoId" = tgg."TipoGastoId" AND t."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      ORDER BY t."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "transporte"'
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
    sortBy = "TransporteId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "TransporteId",
      "TransporteNombre",
      "TransporteTelefono",
      "TransporteDireccion",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "TransporteComision",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "TransporteId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchValue = `%${term}%`;

    const searchQuery = `
      SELECT t.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "transporte" t
      LEFT JOIN "tipogasto" tg ON t."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON t."TipoGastoId" = tgg."TipoGastoId" AND t."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      WHERE t."TransporteNombre" ILIKE $1
        OR t."TransporteTelefono" ILIKE $2
        OR t."TransporteDireccion" ILIKE $3
        OR CAST(t."TransporteId" AS TEXT) ILIKE $4
        OR CAST(t."TipoGastoId" AS TEXT) ILIKE $5
        OR CAST(t."TipoGastoGrupoId" AS TEXT) ILIKE $6
        OR CAST(t."TransporteComision" AS TEXT) ILIKE $7
      ORDER BY t."${sortField}" ${order}
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
      SELECT COUNT(*) as total FROM "transporte"
      WHERE "TransporteNombre" ILIKE $1
        OR "TransporteTelefono" ILIKE $2
        OR "TransporteDireccion" ILIKE $3
        OR CAST("TransporteId" AS TEXT) ILIKE $4
        OR CAST("TipoGastoId" AS TEXT) ILIKE $5
        OR CAST("TipoGastoGrupoId" AS TEXT) ILIKE $6
        OR CAST("TransporteComision" AS TEXT) ILIKE $7
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

  create: async (transporteData) => {
    const query = `
      INSERT INTO "transporte" (
        "TransporteNombre",
        "TransporteTelefono",
        "TransporteDireccion",
        "TipoGastoId",
        "TipoGastoGrupoId",
        "TransporteComision"
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "TransporteId"
    `;

    const values = [
      transporteData.TransporteNombre,
      transporteData.TransporteTelefono || "",
      transporteData.TransporteDireccion || "",
      transporteData.TipoGastoId,
      transporteData.TipoGastoGrupoId,
      transporteData.TransporteComision || 0,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return Transporte.getById(result.rows[0].TransporteId);
  },

  update: async (id, transporteData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "TransporteNombre",
      "TransporteTelefono",
      "TransporteDireccion",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "TransporteComision",
    ];

    camposActualizables.forEach((campo) => {
      if (transporteData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(transporteData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);

    const query = `
      UPDATE "transporte"
      SET ${updateFields.join(", ")}
      WHERE "TransporteId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    return Transporte.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "transporte" WHERE "TransporteId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = Transporte;
