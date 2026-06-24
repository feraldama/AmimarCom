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
    sortOrder = "DESC",
    filters = {}
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

    // Construye los filtros dinámicamente (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, tipoGastoId, tipoGastoGrupoId } =
      filters;
    const conditions = [];
    const params = [];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`r."RegistroDiarioCajaFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`r."RegistroDiarioCajaFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`r."CajaId" = $${params.length}`);
    }
    if (tipoGastoId) {
      params.push(tipoGastoId);
      conditions.push(`r."TipoGastoId" = $${params.length}`);
    }
    if (tipoGastoGrupoId) {
      params.push(tipoGastoGrupoId);
      conditions.push(`r."TipoGastoGrupoId" = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      ${where}
      ORDER BY r."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limit, offset]);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "registrodiariocaja" r ${where}`,
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
    sortBy = "RegistroDiarioCajaFecha",
    sortOrder = "DESC",
    filters = {}
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

    // Grupo de búsqueda por texto (un mismo valor en todos los campos)
    const searchValue = `%${term}%`;
    const params = [searchValue];
    const searchGroup = `(
        r."RegistroDiarioCajaDetalle" ILIKE $1
        OR CAST(r."UsuarioId" AS TEXT) ILIKE $1
        OR CAST(r."CajaId" AS TEXT) ILIKE $1
        OR CAST(r."TipoGastoId" AS TEXT) ILIKE $1
        OR CAST(r."TipoGastoGrupoId" AS TEXT) ILIKE $1
        OR CAST(r."RegistroDiarioCajaMonto" AS TEXT) ILIKE $1
        OR TO_CHAR(r."RegistroDiarioCajaFecha", 'DD/MM/YYYY HH24:MI:SS') ILIKE $1
      )`;

    // Filtros adicionales (rango de fechas + categóricos)
    const { fechaDesde, fechaHasta, cajaId, tipoGastoId, tipoGastoGrupoId } =
      filters;
    const conditions = [searchGroup];
    if (fechaDesde) {
      params.push(fechaDesde);
      conditions.push(`r."RegistroDiarioCajaFecha"::date >= $${params.length}::date`);
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      conditions.push(`r."RegistroDiarioCajaFecha"::date <= $${params.length}::date`);
    }
    if (cajaId) {
      params.push(cajaId);
      conditions.push(`r."CajaId" = $${params.length}`);
    }
    if (tipoGastoId) {
      params.push(tipoGastoId);
      conditions.push(`r."TipoGastoId" = $${params.length}`);
    }
    if (tipoGastoGrupoId) {
      params.push(tipoGastoGrupoId);
      conditions.push(`r."TipoGastoGrupoId" = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;

    const searchQuery = `
      SELECT r.*,
        c."CajaDescripcion",
        t."TipoGastoDescripcion",
        tg."TipoGastoGrupoDescripcion"
      FROM "registrodiariocaja" r
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      ${where}
      ORDER BY r."${sortField}" ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await db.query(searchQuery, [...params, limit, offset]);

    const countQuery = `
      SELECT COUNT(*) as total FROM "registrodiariocaja" r
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

  create: async (registroData) => {
    const query = `
      INSERT INTO "registrodiariocaja" (
        "CajaId",
        "RegistroDiarioCajaFecha",
        "TipoGastoId",
        "TipoGastoGrupoId",
        "RegistroDiarioCajaCambio",
        "RegistroDiarioCajaDetalle",
        "RegistroDiarioCajaMTCN",
        "RegistroDiarioCajaCargoEnvio",
        "RegistroDiarioCajaMonto",
        "RegistroDiarioCajaPendiente1",
        "RegistroDiarioCajaPendiente2",
        "RegistroDiarioCajaPendiente3",
        "RegistroDiarioCajaPendiente4",
        "UsuarioId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING "RegistroDiarioCajaId"
    `;

    const values = [
      registroData.CajaId,
      normalizeRegistroFecha(registroData.RegistroDiarioCajaFecha),
      registroData.TipoGastoId,
      registroData.TipoGastoGrupoId,
      Number(registroData.RegistroDiarioCajaCambio) || 0,
      registroData.RegistroDiarioCajaDetalle,
      Number(registroData.RegistroDiarioCajaMTCN) || 0,
      Number(registroData.RegistroDiarioCajaCargoEnvio) || 0,
      registroData.RegistroDiarioCajaMonto,
      Number(registroData.RegistroDiarioCajaPendiente1) || 0,
      Number(registroData.RegistroDiarioCajaPendiente2) || 0,
      Number(registroData.RegistroDiarioCajaPendiente3) || 0,
      Number(registroData.RegistroDiarioCajaPendiente4) || 0,
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

  // Find the registrodiariocaja entry that was created together with a
  // westernenvio. Used to cascade-delete it when the envío is removed.
  // Matches by (CajaId, TipoGastoId, TipoGastoGrupoId, Fecha, Monto) — these
  // five fields are guaranteed identical between both tables at creation
  // (Fecha is the same string passed to both inserts) and are stored even
  // in legacy rows where MTCN/Cambio were never persisted. Returns the most
  // recent match.
  findByWesternEnvio: async (cajaId, tipoGastoId, tipoGastoGrupoId, fecha, monto) => {
    const result = await db.query(
      `SELECT * FROM "registrodiariocaja"
       WHERE "CajaId" = $1
         AND "TipoGastoId" = $2
         AND "TipoGastoGrupoId" = $3
         AND "RegistroDiarioCajaFecha" = $4
         AND "RegistroDiarioCajaMonto" = $5
       ORDER BY "RegistroDiarioCajaId" DESC
       LIMIT 1`,
      [cajaId, tipoGastoId, tipoGastoGrupoId, fecha, monto]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
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
