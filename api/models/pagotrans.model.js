const db = require("../config/db");

const PagoTrans = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "pagotrans"');
    return result.rows;
  },

  getById: async (id) => {
    const query = `
      SELECT p.*,
        t."TransporteNombre",
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "pagotrans" p
      LEFT JOIN "transporte" t ON p."TransporteId" = t."TransporteId"
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON p."ClienteId" = cl."ClienteId"
      WHERE p."PagoTransId" = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "PagoTransId",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza sortOrder y sortBy para evitar SQL Injection
    const allowedSortFields = [
      "PagoTransId",
      "PagoTransFecha",
      "TransporteId",
      "PagoTransOrigen",
      "PagoTransDestino",
      "PagoTransFechaEmbarque",
      "PagoTransHora",
      "PagoTransAsiento",
      "PagoTransMonto",
      "CajaId",
      "PagoTransNumeroBoleto",
      "PagoTransNombreApellido",
      "PagoTransCI",
      "PagoTransTelefono",
      "ClienteId",
      "PagoTransUsuarioId",
      "PagoTransClienteRUC",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "PagoTransFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, transporteId, cajaId } = filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`p."PagoTransFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`p."PagoTransFecha"::date <= $${params.length}::date`);
    }
    if (transporteId) {
      params.push(transporteId);
      conditions.push(`p."TransporteId" = $${params.length}`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`p."CajaId" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT p.*,
        t."TransporteNombre",
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "pagotrans" p
      LEFT JOIN "transporte" t ON p."TransporteId" = t."TransporteId"
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON p."ClienteId" = cl."ClienteId"
      ${where}
      ORDER BY p."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "pagotrans" p ${where}`,
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
    sortBy = "PagoTransFecha",
    sortOrder = "DESC",
    filters = {}
  ) => {
    // Sanitiza los campos para evitar SQL Injection
    const allowedSortFields = [
      "PagoTransId",
      "PagoTransFecha",
      "TransporteId",
      "PagoTransOrigen",
      "PagoTransDestino",
      "PagoTransFechaEmbarque",
      "PagoTransHora",
      "PagoTransAsiento",
      "PagoTransMonto",
      "CajaId",
      "PagoTransNumeroBoleto",
      "PagoTransNombreApellido",
      "PagoTransCI",
      "PagoTransTelefono",
      "ClienteId",
      "PagoTransUsuarioId",
      "PagoTransClienteRUC",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "PagoTransFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        p."PagoTransOrigen" ILIKE $1
        OR p."PagoTransDestino" ILIKE $1
        OR p."PagoTransNumeroBoleto" ILIKE $1
        OR p."PagoTransNombreApellido" ILIKE $1
        OR p."PagoTransCI" ILIKE $1
        OR p."PagoTransTelefono" ILIKE $1
        OR p."PagoTransClienteRUC" ILIKE $1
        OR CAST(p."TransporteId" AS TEXT) ILIKE $1
        OR CAST(p."CajaId" AS TEXT) ILIKE $1
        OR CAST(p."ClienteId" AS TEXT) ILIKE $1
        OR CAST(p."PagoTransMonto" AS TEXT) ILIKE $1
        OR TO_CHAR(p."PagoTransFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $1
        OR TO_CHAR(p."PagoTransFechaEmbarque", 'DD/MM/YYYY') ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, transporteId, cajaId } = filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`p."PagoTransFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`p."PagoTransFecha"::date <= $${params.length}::date`);
    }
    if (transporteId) {
      params.push(transporteId);
      conditions.push(`p."TransporteId" = $${params.length}`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`p."CajaId" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT p.*,
        t."TransporteNombre",
        c."CajaDescripcion",
        cl."ClienteNombre",
        cl."ClienteApellido"
      FROM "pagotrans" p
      LEFT JOIN "transporte" t ON p."TransporteId" = t."TransporteId"
      LEFT JOIN "caja" c ON p."CajaId" = c."CajaId"
      LEFT JOIN "clientes" cl ON p."ClienteId" = cl."ClienteId"
      ${where}
      ORDER BY p."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "pagotrans" p
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

  create: async (pagoTransData) => {
    const query = `
      INSERT INTO "pagotrans" (
        "PagoTransFecha",
        "TransporteId",
        "PagoTransOrigen",
        "PagoTransDestino",
        "PagoTransFechaEmbarque",
        "PagoTransHora",
        "PagoTransAsiento",
        "PagoTransMonto",
        "CajaId",
        "PagoTransNumeroBoleto",
        "PagoTransNombreApellido",
        "PagoTransCI",
        "PagoTransTelefono",
        "ClienteId",
        "PagoTransUsuarioId",
        "PagoTransClienteRUC"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING "PagoTransId"
    `;

    const values = [
      pagoTransData.PagoTransFecha || new Date(),
      pagoTransData.TransporteId || null,
      pagoTransData.PagoTransOrigen || "",
      pagoTransData.PagoTransDestino || "",
      pagoTransData.PagoTransFechaEmbarque || null,
      pagoTransData.PagoTransHora || "",
      pagoTransData.PagoTransAsiento || "",
      pagoTransData.PagoTransMonto || 0,
      pagoTransData.CajaId || null,
      pagoTransData.PagoTransNumeroBoleto || "",
      pagoTransData.PagoTransNombreApellido || "",
      pagoTransData.PagoTransCI || "",
      pagoTransData.PagoTransTelefono || "",
      pagoTransData.ClienteId || null,
      pagoTransData.PagoTransUsuarioId || null,
      pagoTransData.PagoTransClienteRUC || "",
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    return PagoTrans.getById(result.rows[0].PagoTransId);
  },

  update: async (id, pagoTransData) => {
    // Construir la consulta dinámicamente
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "PagoTransFecha",
      "TransporteId",
      "PagoTransOrigen",
      "PagoTransDestino",
      "PagoTransFechaEmbarque",
      "PagoTransHora",
      "PagoTransAsiento",
      "PagoTransMonto",
      "CajaId",
      "PagoTransNumeroBoleto",
      "PagoTransNombreApellido",
      "PagoTransCI",
      "PagoTransTelefono",
      "ClienteId",
      "PagoTransUsuarioId",
      "PagoTransClienteRUC",
    ];

    camposActualizables.forEach((campo) => {
      if (pagoTransData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        values.push(pagoTransData[campo]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    values.push(id);

    const query = `
      UPDATE "pagotrans"
      SET ${updateFields.join(", ")}
      WHERE "PagoTransId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontró el registro
    }

    // Obtener el registro actualizado
    return PagoTrans.getById(id);
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "pagotrans" WHERE "PagoTransId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  // Ventas de pasajes de una empresa de transporte en un rango de fechas,
  // con la comisión de la empresa para calcular la liquidación.
  // cajaIds: lista opcional de CajaId a incluir (vacía = todas)
  getReportePagos: async (fechaDesde, fechaHasta, transporteId, cajaIds) => {
    const params = [fechaDesde, fechaHasta, transporteId];
    let filtroCajas = "";
    if (Array.isArray(cajaIds) && cajaIds.length > 0) {
      params.push(cajaIds.map(Number));
      filtroCajas = `AND p."CajaId" = ANY($${params.length}::int[])`;
    }
    const result = await db.query(
      `SELECT p.*,
        t."TransporteNombre",
        t."TransporteComision",
        u."UsuarioNombre"
      FROM "pagotrans" p
      LEFT JOIN "transporte" t ON p."TransporteId" = t."TransporteId"
      LEFT JOIN "usuario" u ON p."PagoTransUsuarioId" = u."UsuarioId"
      WHERE p."TransporteId" = $3
        AND p."PagoTransFecha"::date >= $1::date
        AND p."PagoTransFecha"::date <= $2::date
        ${filtroCajas}
      ORDER BY p."PagoTransFecha" ASC, p."PagoTransId" ASC`,
      params
    );
    return result.rows;
  },
};

module.exports = PagoTrans;
