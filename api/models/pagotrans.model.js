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
    sortOrder = "DESC"
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
      ORDER BY p."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "pagotrans"'
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
    sortOrder = "DESC"
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
      WHERE p."PagoTransOrigen" ILIKE $1
        OR p."PagoTransDestino" ILIKE $2
        OR p."PagoTransNumeroBoleto" ILIKE $3
        OR p."PagoTransNombreApellido" ILIKE $4
        OR p."PagoTransCI" ILIKE $5
        OR p."PagoTransTelefono" ILIKE $6
        OR p."PagoTransClienteRUC" ILIKE $7
        OR CAST(p."TransporteId" AS TEXT) ILIKE $8
        OR CAST(p."CajaId" AS TEXT) ILIKE $9
        OR CAST(p."ClienteId" AS TEXT) ILIKE $10
        OR CAST(p."PagoTransMonto" AS TEXT) ILIKE $11
        OR TO_CHAR(p."PagoTransFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $12
        OR TO_CHAR(p."PagoTransFechaEmbarque", 'DD/MM/YYYY') ILIKE $13
      ORDER BY p."${sortField}" ${order}
      LIMIT $14 OFFSET $15
    `;

    const result = await db.query(searchQuery, [
      searchValue, // Origen
      searchValue, // Destino
      searchValue, // NumeroBoleto
      searchValue, // NombreApellido
      searchValue, // CI
      searchValue, // Telefono
      searchValue, // ClienteRUC
      searchValue, // TransporteId
      searchValue, // CajaId
      searchValue, // ClienteId
      searchValue, // Monto
      searchValue, // Fecha
      searchValue, // FechaEmbarque
      limit,
      offset,
    ]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "pagotrans"
      WHERE "PagoTransOrigen" ILIKE $1
        OR "PagoTransDestino" ILIKE $2
        OR "PagoTransNumeroBoleto" ILIKE $3
        OR "PagoTransNombreApellido" ILIKE $4
        OR "PagoTransCI" ILIKE $5
        OR "PagoTransTelefono" ILIKE $6
        OR "PagoTransClienteRUC" ILIKE $7
        OR CAST("TransporteId" AS TEXT) ILIKE $8
        OR CAST("CajaId" AS TEXT) ILIKE $9
        OR CAST("ClienteId" AS TEXT) ILIKE $10
        OR CAST("PagoTransMonto" AS TEXT) ILIKE $11
        OR TO_CHAR("PagoTransFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $12
        OR TO_CHAR("PagoTransFechaEmbarque", 'DD/MM/YYYY') ILIKE $13
    `;

    const countResult = await db.query(countQuery, [
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
};

module.exports = PagoTrans;
