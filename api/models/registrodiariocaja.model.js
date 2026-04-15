const db = require("../config/db");

/**
 * Normaliza RegistroDiarioCajaFecha para que siempre incluya fecha y hora.
 * - Si no se proporciona valor: usa fecha/hora actual
 * - Si es solo fecha (YYYY-MM-DD): usa esa fecha con la hora actual del momento del registro
 * - Si es datetime completo: lo usa tal cual
 */
function normalizeRegistroFecha(value) {
  if (!value) return new Date();
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const now = new Date();
    const [y, m, d] = str.split("-").map(Number);
    return new Date(
      y,
      m - 1,
      d,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

const RegistroDiarioCaja = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "registrodiariocaja"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "registrodiariocaja" WHERE "RegistroDiarioCajaId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "RegistroDiarioCajaId",
    sortOrder = "DESC"
  ) => {
    // Sanitiza sortOrder y sortBy para evitar SQL Injection
    const allowedSortFields = [
      "RegistroDiarioCajaId",
      "RegistroDiarioCajaFecha",
      "RegistroDiarioCajaMonto",
      "RegistroDiarioCajaDetalle",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "UsuarioId",
      "CajaId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "RegistroDiarioCajaFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const query = `
      SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      ORDER BY r."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "registrodiariocaja"'
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
    sortBy = "RegistroDiarioCajaFecha",
    sortOrder = "DESC"
  ) => {
    // Sanitiza los campos para evitar SQL Injection
    const allowedSortFields = [
      "RegistroDiarioCajaId",
      "RegistroDiarioCajaFecha",
      "RegistroDiarioCajaMonto",
      "RegistroDiarioCajaDetalle",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "UsuarioId",
      "CajaId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "RegistroDiarioCajaFecha";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchQuery = `
      SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      WHERE r."RegistroDiarioCajaDetalle" ILIKE $1
        OR CAST(r."UsuarioId" AS TEXT) ILIKE $2
        OR CAST(r."CajaId" AS TEXT) ILIKE $3
        OR CAST(r."TipoGastoId" AS TEXT) ILIKE $4
        OR CAST(r."TipoGastoGrupoId" AS TEXT) ILIKE $5
        OR CAST(r."RegistroDiarioCajaMonto" AS TEXT) ILIKE $6
        OR TO_CHAR(r."RegistroDiarioCajaFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $7
      ORDER BY r."${sortField}" ${order}
      LIMIT $8 OFFSET $9
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(
      searchQuery,
      [
        searchValue, // Detalle
        searchValue, // UsuarioId
        searchValue, // CajaId
        searchValue, // TipoGastoId
        searchValue, // TipoGastoGrupoId
        searchValue, // Monto
        searchValue, // Fecha
        limit,
        offset,
      ]
    );

    const countQuery = `
      SELECT COUNT(*) as total FROM "registrodiariocaja"
      WHERE "RegistroDiarioCajaDetalle" ILIKE $1
        OR CAST("UsuarioId" AS TEXT) ILIKE $2
        OR CAST("CajaId" AS TEXT) ILIKE $3
        OR CAST("TipoGastoId" AS TEXT) ILIKE $4
        OR CAST("TipoGastoGrupoId" AS TEXT) ILIKE $5
        OR CAST("RegistroDiarioCajaMonto" AS TEXT) ILIKE $6
        OR TO_CHAR("RegistroDiarioCajaFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $7
    `;

    const countResult = await db.query(
      countQuery,
      [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
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

  create: async (registroData) => {
    const query = `
      INSERT INTO "registrodiariocaja" (
        "CajaId",
        "RegistroDiarioCajaFecha",
        "TipoGastoId",
        "TipoGastoGrupoId",
        "RegistroDiarioCajaDetalle",
        "RegistroDiarioCajaMonto",
        "UsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "RegistroDiarioCajaId"
    `;

    const values = [
      registroData.CajaId,
      normalizeRegistroFecha(registroData.RegistroDiarioCajaFecha),
      registroData.TipoGastoId,
      registroData.TipoGastoGrupoId,
      registroData.RegistroDiarioCajaDetalle,
      registroData.RegistroDiarioCajaMonto,
      registroData.UsuarioId,
    ];

    const result = await db.query(query, values);
    const registro = await RegistroDiarioCaja.getById(result.rows[0].RegistroDiarioCajaId);
    return registro;
  },

  update: async (id, registroData) => {
    // Construir la consulta dinamicamente
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    const camposActualizables = [
      "CajaId",
      "RegistroDiarioCajaFecha",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "RegistroDiarioCajaDetalle",
      "RegistroDiarioCajaMonto",
      "UsuarioId",
    ];

    camposActualizables.forEach((campo) => {
      if (registroData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        const valor =
          campo === "RegistroDiarioCajaFecha"
            ? normalizeRegistroFecha(registroData[campo])
            : registroData[campo];
        values.push(valor);
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    values.push(id);

    const query = `
      UPDATE "registrodiariocaja"
      SET ${updateFields.join(", ")}
      WHERE "RegistroDiarioCajaId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontro el registro
    }

    // Obtener el registro actualizado
    const registro = await RegistroDiarioCaja.getById(id);
    return registro;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "registrodiariocaja" WHERE "RegistroDiarioCajaId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  getUltimaApertura: async (cajaId) => {
    const result = await db.query(
      `SELECT * FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [cajaId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getUltimoCierre: async (cajaId) => {
    const result = await db.query(
      `SELECT * FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [cajaId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getByDateRange: async (fechaDesdeStr, fechaHastaStr, limit = 10000) => {
    const query = `
      SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      WHERE r."RegistroDiarioCajaFecha"::date >= $1::date AND r."RegistroDiarioCajaFecha"::date <= $2::date
      ORDER BY r."RegistroDiarioCajaId" ASC
      LIMIT $3
    `;
    const result = await db.query(query, [fechaDesdeStr, fechaHastaStr, limit]);
    return result.rows;
  },

  getEstadoAperturaPorUsuario: async (usuarioId) => {
    // Buscar la ultima apertura del usuario
    const aperturasResult = await db.query(
      `SELECT "RegistroDiarioCajaId", "CajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId]
    );
    const apertura = aperturasResult.rows[0] || {
      RegistroDiarioCajaId: 0,
      CajaId: null,
    };

    // Buscar el ultimo cierre del usuario
    const cierresResult = await db.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId]
    );
    const cierre = cierresResult.rows[0] || { RegistroDiarioCajaId: 0 };

    return {
      aperturaId: apertura.RegistroDiarioCajaId || 0,
      cierreId: cierre.RegistroDiarioCajaId || 0,
      cajaId: apertura.CajaId || null,
    };
  },
  // ── REPORTES ──

  getReportePaseCajas: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      WHERE r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
      ORDER BY r."CajaId", r."RegistroDiarioCajaId" ASC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },

  getReporteMovimientosCajas: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT r.*,
        c."CajaDescripcion",
        c."CajaTipoId",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "usuario" u ON r."UsuarioId" = u."UsuarioId"
      WHERE c."CajaTipoId" = 1
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
      ORDER BY r."RegistroDiarioCajaId" ASC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },

  getCierreDiario: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT
        c."CajaId",
        c."CajaDescripcion",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = 2 THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "TotalIngresos",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = 1 THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "TotalEgresos",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = 2 THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = 1 THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "Saldo",
        COUNT(*) AS "CantMovimientos"
      FROM "registrodiariocaja" r
      JOIN "caja" c ON r."CajaId" = c."CajaId"
      WHERE r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
      GROUP BY c."CajaId", c."CajaDescripcion"
      ORDER BY c."CajaDescripcion"`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },
};

module.exports = RegistroDiarioCaja;
