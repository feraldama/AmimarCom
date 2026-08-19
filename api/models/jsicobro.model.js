const db = require("../config/db");

const JSICobro = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "jsicobro"');
    return result.rows;
  },

  getById: async (id) => {
    const query = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      WHERE j."JSICobroId" = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "JSICobroId",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza sortOrder y sortBy para evitar SQL Injection
    const allowedSortFields = [
      "JSICobroId",
      "CajaId",
      "JSICobroFecha",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "JSICobroFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, clienteId } = filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`j."JSICobroFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`j."JSICobroFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`j."CajaId" = $${params.length}`);
    }
    if (clienteId) {
      params.push(clienteId);
      conditions.push(`j."ClienteId" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      ${where}
      ORDER BY j."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "jsicobro" j ${where}`,
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
    sortBy = "JSICobroFecha",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza los campos para evitar SQL Injection
    const allowedSortFields = [
      "JSICobroId",
      "CajaId",
      "JSICobroFecha",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "JSICobroFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        CAST(j."JSICobroId" AS TEXT) ILIKE $1
        OR CAST(j."CajaId" AS TEXT) ILIKE $1
        OR CAST(j."ClienteId" AS TEXT) ILIKE $1
        OR CAST(j."JSICobroMonto" AS TEXT) ILIKE $1
        OR CAST(j."JSICobroUsuarioId" AS TEXT) ILIKE $1
        OR TO_CHAR(j."JSICobroFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $1
        OR cl."ClienteNombre" ILIKE $1
        OR cl."ClienteApellido" ILIKE $1
        OR c."CajaDescripcion" ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, clienteId } = filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`j."JSICobroFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`j."JSICobroFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`j."CajaId" = $${params.length}`);
    }
    if (clienteId) {
      params.push(clienteId);
      conditions.push(`j."ClienteId" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT j.*,
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      ${where}
      ORDER BY j."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "jsicobro" j
      LEFT JOIN "caja" c ON j."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      ${where}
    `;

    const countResult = await db.query(countQuery, params);

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

  create: async (jsicobroData) => {
    const query = `
      INSERT INTO "jsicobro" (
        "CajaId",
        "JSICobroFecha",
        "ClienteId",
        "JSICobroMonto",
        "JSICobroUsuarioId"
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING "JSICobroId"
    `;

    const values = [
      jsicobroData.CajaId || null,
      jsicobroData.JSICobroFecha || new Date(),
      jsicobroData.ClienteId || null,
      jsicobroData.JSICobroMonto || 0,
      jsicobroData.JSICobroUsuarioId || null,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return JSICobro.getById(result.rows[0].JSICobroId);
  },

  update: async (id, jsicobroData) => {
    // Construir la consulta dinámicamente
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaId",
      "JSICobroFecha",
      "ClienteId",
      "JSICobroMonto",
      "JSICobroUsuarioId",
    ];

    camposActualizables.forEach((campo) => {
      if (jsicobroData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(jsicobroData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    values.push(id);

    const query = `
      UPDATE "jsicobro"
      SET ${updateFields.join(", ")}
      WHERE "JSICobroId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontró el registro
    }

    // Obtener el registro actualizado
    return JSICobro.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "jsicobro" WHERE "JSICobroId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  // Cobros JSI de un rango de fechas con el cliente, para el reporte de
  // rendición a la Junta de Saneamiento.
  getReporteCobros: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT j.*,
        cl."ClienteNombre",
        cl."ClienteApellido",
        u."UsuarioNombre"
      FROM "jsicobro" j
      LEFT JOIN "clientes" cl ON j."ClienteId" = cl."ClienteId"
      LEFT JOIN "usuario" u ON j."JSICobroUsuarioId" = u."UsuarioId"
      WHERE j."JSICobroFecha"::date >= $1::date
        AND j."JSICobroFecha"::date <= $2::date
      ORDER BY j."JSICobroFecha" ASC, j."JSICobroId" ASC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },
};

module.exports = JSICobro;
