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
    sortOrder = "DESC",
    filters = {}
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

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, tipoGastoGrupoId } = filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`we."WesternEnvioFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`we."WesternEnvioFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`we."CajaId" = $${params.length}`);
    }
    if (tipoGastoGrupoId) {
      params.push(tipoGastoGrupoId);
      conditions.push(`we."TipoGastoGrupoId" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

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
      ${where}
      ORDER BY we."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "westernenvio" we ${where}`,
      params
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
    sortOrder = "DESC",
    filters = {}
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

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        we."WesternEnvioDetalle" ILIKE $1
        OR CAST(we."WesternEnvioUsuarioId" AS TEXT) ILIKE $1
        OR CAST(we."CajaId" AS TEXT) ILIKE $1
        OR CAST(we."TipoGastoId" AS TEXT) ILIKE $1
        OR CAST(we."TipoGastoGrupoId" AS TEXT) ILIKE $1
        OR CAST(we."WesternEnvioMonto" AS TEXT) ILIKE $1
        OR CAST(we."WesternEnvioMTCN" AS TEXT) ILIKE $1
        OR CAST(we."WesternEnvioFactura" AS TEXT) ILIKE $1
        OR CAST(we."WesternEnvioTimbrado" AS TEXT) ILIKE $1
        OR CAST(we."ClienteId" AS TEXT) ILIKE $1
        OR TO_CHAR(we."WesternEnvioFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, tipoGastoGrupoId } = filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`we."WesternEnvioFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`we."WesternEnvioFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`we."CajaId" = $${params.length}`);
    }
    if (tipoGastoGrupoId) {
      params.push(tipoGastoGrupoId);
      conditions.push(`we."TipoGastoGrupoId" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

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
      ${where}
      ORDER BY we."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "westernenvio" we
      ${where}`,
      params
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
