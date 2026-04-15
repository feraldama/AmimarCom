const db = require("../config/db");

const WesternEnvio = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "westernenvio"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT we.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "westernenvio" we
      LEFT JOIN "caja" c ON we."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON we."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON we."TipoGastoId" = tg."TipoGastoId" AND we."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "usuario" u ON we."WesternEnvioUsuarioId" = u."UsuarioId"
      WHERE we."WesternEnvioId" = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "WesternEnvioId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "WesternEnvioId",
      "WesternEnvioFecha",
      "WesternEnvioMonto",
      "WesternEnvioDetalle",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "WesternEnvioUsuarioId",
      "CajaId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "WesternEnvioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const result = await db.query(
      `SELECT we.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "westernenvio" we
      LEFT JOIN "caja" c ON we."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON we."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON we."TipoGastoId" = tg."TipoGastoId" AND we."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "usuario" u ON we."WesternEnvioUsuarioId" = u."UsuarioId"
      ORDER BY we."${sortField}" ${order}
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "westernenvio"'
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
    sortBy = "WesternEnvioId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "WesternEnvioId",
      "WesternEnvioFecha",
      "WesternEnvioMonto",
      "WesternEnvioDetalle",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "WesternEnvioUsuarioId",
      "CajaId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "WesternEnvioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchValue = `%${term}%`;

    const result = await db.query(
      `SELECT we.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "westernenvio" we
      LEFT JOIN "caja" c ON we."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON we."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON we."TipoGastoId" = tg."TipoGastoId" AND we."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "usuario" u ON we."WesternEnvioUsuarioId" = u."UsuarioId"
      WHERE we."WesternEnvioDetalle" ILIKE $1
        OR CAST(we."WesternEnvioUsuarioId" AS TEXT) ILIKE $2
        OR CAST(we."CajaId" AS TEXT) ILIKE $3
        OR CAST(we."TipoGastoId" AS TEXT) ILIKE $4
        OR CAST(we."TipoGastoGrupoId" AS TEXT) ILIKE $5
        OR CAST(we."WesternEnvioMonto" AS TEXT) ILIKE $6
        OR CAST(we."WesternEnvioMTCN" AS TEXT) ILIKE $7
        OR CAST(we."WesternEnvioFactura" AS TEXT) ILIKE $8
        OR CAST(we."WesternEnvioTimbrado" AS TEXT) ILIKE $9
        OR CAST(we."ClienteId" AS TEXT) ILIKE $10
        OR TO_CHAR(we."WesternEnvioFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $11
      ORDER BY we."${sortField}" ${order}
      LIMIT $12 OFFSET $13`,
      [
        searchValue, searchValue, searchValue, searchValue, searchValue,
        searchValue, searchValue, searchValue, searchValue, searchValue,
        searchValue, limit, offset,
      ]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "westernenvio" we
      WHERE we."WesternEnvioDetalle" ILIKE $1
        OR CAST(we."WesternEnvioUsuarioId" AS TEXT) ILIKE $2
        OR CAST(we."CajaId" AS TEXT) ILIKE $3
        OR CAST(we."TipoGastoId" AS TEXT) ILIKE $4
        OR CAST(we."TipoGastoGrupoId" AS TEXT) ILIKE $5
        OR CAST(we."WesternEnvioMonto" AS TEXT) ILIKE $6
        OR CAST(we."WesternEnvioMTCN" AS TEXT) ILIKE $7
        OR CAST(we."WesternEnvioFactura" AS TEXT) ILIKE $8
        OR CAST(we."WesternEnvioTimbrado" AS TEXT) ILIKE $9
        OR CAST(we."ClienteId" AS TEXT) ILIKE $10
        OR TO_CHAR(we."WesternEnvioFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $11`,
      [
        searchValue, searchValue, searchValue, searchValue, searchValue,
        searchValue, searchValue, searchValue, searchValue, searchValue,
        searchValue,
      ]
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

  create: async (envioData) => {
    const result = await db.query(
      `INSERT INTO "westernenvio" (
        "CajaId",
        "WesternEnvioFecha",
        "TipoGastoId",
        "TipoGastoGrupoId",
        "WesternEnvioCambio",
        "WesternEnvioDetalle",
        "WesternEnvioMTCN",
        "WesternEnvioCargoEnvio",
        "WesternEnvioFactura",
        "WesternEnvioTimbrado",
        "WesternEnvioMonto",
        "WesternEnvioUsuarioId",
        "ClienteId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING "WesternEnvioId"`,
      [
        envioData.CajaId,
        envioData.WesternEnvioFecha || new Date(),
        envioData.TipoGastoId,
        envioData.TipoGastoGrupoId,
        envioData.WesternEnvioCambio || 0,
        envioData.WesternEnvioDetalle,
        envioData.WesternEnvioMTCN || 0,
        envioData.WesternEnvioCargoEnvio || 0,
        envioData.WesternEnvioFactura === "" || envioData.WesternEnvioFactura == null ? 0 : envioData.WesternEnvioFactura,
        envioData.WesternEnvioTimbrado === "" || envioData.WesternEnvioTimbrado == null ? 0 : envioData.WesternEnvioTimbrado,
        envioData.WesternEnvioMonto,
        envioData.WesternEnvioUsuarioId,
        envioData.ClienteId || null,
      ]
    );

    return WesternEnvio.getById(result.rows[0].WesternEnvioId);
  },

  update: async (id, envioData) => {
    const camposActualizables = [
      "CajaId",
      "WesternEnvioFecha",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "WesternEnvioCambio",
      "WesternEnvioDetalle",
      "WesternEnvioMTCN",
      "WesternEnvioCargoEnvio",
      "WesternEnvioFactura",
      "WesternEnvioTimbrado",
      "WesternEnvioMonto",
      "WesternEnvioUsuarioId",
      "ClienteId",
    ];

    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    camposActualizables.forEach((campo) => {
      if (envioData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        const valor = (campo === "WesternEnvioFactura" || campo === "WesternEnvioTimbrado") && (envioData[campo] === "" || envioData[campo] == null)
          ? 0
          : envioData[campo];
        values.push(valor);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) return null;

    values.push(id);

    const result = await db.query(
      `UPDATE "westernenvio"
      SET ${updateFields.join(", ")}
      WHERE "WesternEnvioId" = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) return null;

    return WesternEnvio.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "westernenvio" WHERE "WesternEnvioId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },
};

module.exports = WesternEnvio;
