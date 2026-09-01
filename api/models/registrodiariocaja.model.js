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

// Mapeo override para cajas cuyo grupo PASE no sigue la convención
// "PASE <CajaDescripcion>" en tipogastogrupo (misma convención que usa el
// frontend en PaseCajasTab). Ej: CAJA AMIL usa el grupo "PASE JEFE".
const PASE_GRUPO_OVERRIDE = {
  "CAJA AMIL": "PASE JEFE",
};

// Resuelve el grupo PASE de tipogastogrupo para una caja dada y un
// TipoGastoId (1=Egreso, 2=Ingreso). Devuelve undefined si no existe.
async function resolvePaseGrupo(client, caja, tipoGastoId) {
  const desc = String(caja.CajaDescripcion || "")
    .trim()
    .toUpperCase();
  const target = PASE_GRUPO_OVERRIDE[desc] || `PASE ${desc}`;
  const result = await client.query(
    `SELECT "TipoGastoId", "TipoGastoGrupoId", "TipoGastoGrupoDescripcion"
     FROM "tipogastogrupo"
     WHERE "TipoGastoId" = $1
       AND UPPER(TRIM("TipoGastoGrupoDescripcion")) = $2`,
    [tipoGastoId, target]
  );
  return result.rows[0];
}

// Si hay cajas seleccionadas, las agrega a params y devuelve la cláusula
// "AND <columna> = ANY($n::int[])"; si no, devuelve cadena vacía (todas).
function filtroCajasSql(params, cajaIds, columna) {
  if (!Array.isArray(cajaIds) || cajaIds.length === 0) return "";
  params.push(cajaIds.map(Number));
  return `AND ${columna} = ANY($${params.length}::int[])`;
}

const INSERT_REGISTRO_QUERY = `
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

  // Crea un pase entre cajas de forma atómica: inserta el EGRESO en la caja
  // origen y el INGRESO en la caja destino, y ajusta ambos saldos, todo dentro
  // de una única transacción. Los grupos PASE se resuelven acá (no se confía
  // en el cliente) según la convención "PASE <CajaDescripcion>".
  createPase: async ({
    CajaOrigenId,
    CajaDestinoId,
    RegistroDiarioCajaFecha,
    RegistroDiarioCajaDetalle,
    RegistroDiarioCajaMonto,
    UsuarioId,
  }) => {
    const origenId = Number(CajaOrigenId);
    const destinoId = Number(CajaDestinoId);
    const monto = Number(RegistroDiarioCajaMonto);
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Bloquear ambas cajas en orden estable (por CajaId) para evitar
      // deadlocks entre pases concurrentes.
      const cajasResult = await client.query(
        `SELECT "CajaId", "CajaDescripcion" FROM "caja"
         WHERE "CajaId" = ANY($1::int[])
         ORDER BY "CajaId"
         FOR UPDATE`,
        [[origenId, destinoId]]
      );
      const cajaOrigen = cajasResult.rows.find(
        (c) => Number(c.CajaId) === origenId
      );
      const cajaDestino = cajasResult.rows.find(
        (c) => Number(c.CajaId) === destinoId
      );
      if (!cajaOrigen || !cajaDestino) {
        throw new Error("Caja origen o destino no encontrada");
      }

      // Grupo del EGRESO en la caja origen: "PASE <destino>".
      // Grupo del INGRESO en la caja destino: "PASE <origen>".
      const grupoEgreso = await resolvePaseGrupo(client, cajaDestino, 1);
      const grupoIngreso = await resolvePaseGrupo(client, cajaOrigen, 2);
      if (!grupoEgreso || !grupoIngreso) {
        throw new Error(
          "Falta el grupo 'PASE <CajaDescripcion>' en tipogastogrupo para una de las cajas involucradas"
        );
      }

      const fecha = normalizeRegistroFecha(RegistroDiarioCajaFecha);

      const egresoResult = await client.query(INSERT_REGISTRO_QUERY, [
        origenId,
        fecha,
        1,
        grupoEgreso.TipoGastoGrupoId,
        0,
        RegistroDiarioCajaDetalle,
        0,
        0,
        monto,
        0,
        0,
        0,
        0,
        UsuarioId,
      ]);
      const ingresoResult = await client.query(INSERT_REGISTRO_QUERY, [
        destinoId,
        fecha,
        2,
        grupoIngreso.TipoGastoGrupoId,
        0,
        RegistroDiarioCajaDetalle,
        0,
        0,
        monto,
        0,
        0,
        0,
        0,
        UsuarioId,
      ]);

      await client.query(
        'UPDATE "caja" SET "CajaMonto" = "CajaMonto" - $1 WHERE "CajaId" = $2',
        [monto, origenId]
      );
      await client.query(
        'UPDATE "caja" SET "CajaMonto" = "CajaMonto" + $1 WHERE "CajaId" = $2',
        [monto, destinoId]
      );

      await client.query("COMMIT");
      return {
        egresoId: egresoResult.rows[0].RegistroDiarioCajaId,
        ingresoId: ingresoResult.rows[0].RegistroDiarioCajaId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Elimina una pata de un pase entre cajas junto con su contrapartida (si se
  // puede identificar), revirtiendo los saldos de las cajas involucradas.
  // Todo dentro de una transacción. La contrapartida se identifica por:
  // tipo opuesto, grupo "PASE ...", mismo monto, misma fecha, mismo usuario y
  // distinta caja. Si no existe (pata huérfana), se elimina sólo el registro
  // recibido y se revierte únicamente su caja.
  deletePase: async (registro) => {
    const registroId = Number(registro.RegistroDiarioCajaId);
    const monto = Number(registro.RegistroDiarioCajaMonto) || 0;
    const tipoOpuesto = Number(registro.TipoGastoId) === 1 ? 2 : 1;
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const contrapartidaResult = await client.query(
        `SELECT r."RegistroDiarioCajaId", r."CajaId", r."TipoGastoId",
                r."RegistroDiarioCajaMonto"
         FROM "registrodiariocaja" r
         JOIN "tipogastogrupo" tg
           ON r."TipoGastoId" = tg."TipoGastoId"
          AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
         WHERE r."TipoGastoId" = $1
           AND TRIM(tg."TipoGastoGrupoDescripcion") ILIKE 'PASE %'
           AND r."RegistroDiarioCajaMonto" = $2
           AND r."RegistroDiarioCajaFecha" = $3
           AND r."UsuarioId" = $4
           AND r."CajaId" <> $5
           AND r."RegistroDiarioCajaId" <> $6
         ORDER BY r."RegistroDiarioCajaId"
         LIMIT 1
         FOR UPDATE OF r`,
        [
          tipoOpuesto,
          monto,
          registro.RegistroDiarioCajaFecha,
          registro.UsuarioId,
          registro.CajaId,
          registroId,
        ]
      );
      const contrapartida = contrapartidaResult.rows[0] || null;

      const patas = contrapartida ? [registro, contrapartida] : [registro];
      for (const pata of patas) {
        // Revertir: un EGRESO había restado (ahora suma), un INGRESO había
        // sumado (ahora resta).
        const esEgreso = Number(pata.TipoGastoId) === 1;
        const montoPata = Number(pata.RegistroDiarioCajaMonto) || 0;
        await client.query(
          `UPDATE "caja" SET "CajaMonto" = "CajaMonto" ${esEgreso ? "+" : "-"} $1
           WHERE "CajaId" = $2`,
          [montoPata, pata.CajaId]
        );
        await client.query(
          'DELETE FROM "registrodiariocaja" WHERE "RegistroDiarioCajaId" = $1',
          [pata.RegistroDiarioCajaId]
        );
      }

      await client.query("COMMIT");
      return {
        eliminados: patas.map((p) => Number(p.RegistroDiarioCajaId)),
        contrapartidaId: contrapartida
          ? Number(contrapartida.RegistroDiarioCajaId)
          : null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    // Busca, por caja, la ultima apertura del usuario que NO tenga un cierre
    // posterior sobre esa misma caja. Se evalua por caja (y no solo la
    // ultima apertura vs. el ultimo cierre del usuario) para que una caja
    // que quedo abierta no se "tape" con la apertura/cierre de otra caja.
    const abiertaResult = await db.query(
      `SELECT a."RegistroDiarioCajaId", a."CajaId"
       FROM "registrodiariocaja" a
       WHERE a."UsuarioId" = $1
         AND a."TipoGastoId" = 2
         AND a."TipoGastoGrupoId" = 2
         AND NOT EXISTS (
           SELECT 1 FROM "registrodiariocaja" c
           WHERE c."CajaId" = a."CajaId"
             AND c."TipoGastoId" = 1
             AND c."TipoGastoGrupoId" = 2
             AND c."RegistroDiarioCajaId" > a."RegistroDiarioCajaId"
         )
       ORDER BY a."RegistroDiarioCajaId" ASC
       LIMIT 1`,
      [usuarioId]
    );
    const abierta = abiertaResult.rows[0];

    if (abierta) {
      // Ultimo cierre de esa caja (siempre menor a la apertura, por definicion)
      const cierreResult = await db.query(
        `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2 AND "RegistroDiarioCajaId" < $2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
        [abierta.CajaId, abierta.RegistroDiarioCajaId]
      );
      return {
        aperturaId: abierta.RegistroDiarioCajaId,
        cierreId: cierreResult.rows[0]?.RegistroDiarioCajaId || 0,
        cajaId: abierta.CajaId,
      };
    }

    // Sin caja abierta: devolver la ultima apertura/cierre del usuario
    // (cierreId >= aperturaId) para mantener el contrato del endpoint.
    const aperturasResult = await db.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId]
    );
    const cierresResult = await db.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId]
    );
    const aperturaId = aperturasResult.rows[0]?.RegistroDiarioCajaId || 0;
    const cierreId = cierresResult.rows[0]?.RegistroDiarioCajaId || 0;
    return {
      aperturaId,
      cierreId: Math.max(cierreId, aperturaId),
      cajaId: null,
    };
  },
  // ── REPORTES ──

  // Pases entre cajas: registros cuyo grupo sigue la convención "PASE <caja>"
  // (incluye overrides como "PASE JEFE"). Devuelve también todas las cajas
  // tipo 1 para que el reporte las liste aunque no tengan pases.
  getReportePaseCajas: async (fechaDesde, fechaHasta, cajaIds) => {
    const cajasParams = [];
    const filtroCajasLista = filtroCajasSql(cajasParams, cajaIds, '"CajaId"');
    const cajasResult = await db.query(
      `SELECT "CajaId", "CajaDescripcion" FROM "caja"
       WHERE "CajaTipoId" = 1 ${filtroCajasLista}
       ORDER BY "CajaId"`,
      cajasParams
    );
    const movsParams = [fechaDesde, fechaHasta];
    const filtroCajasMovs = filtroCajasSql(movsParams, cajaIds, 'r."CajaId"');
    const movsResult = await db.query(
      `SELECT r.*,
        c."CajaDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "registrodiariocaja" r
      JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "usuario" u ON r."UsuarioId" = u."UsuarioId"
      WHERE TRIM(tg."TipoGastoGrupoDescripcion") ILIKE 'PASE %'
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        ${filtroCajasMovs}
      ORDER BY r."CajaId", r."RegistroDiarioCajaId" ASC`,
      movsParams
    );
    return { cajas: cajasResult.rows, movimientos: movsResult.rows };
  },

  // cajaIds: lista opcional de CajaId a incluir (vacía/undefined = todas).
  // tipoGastoId: opcional, 1=egresos o 2=ingresos (undefined = ambos).
  getReporteMovimientosCajas: async (
    fechaDesde,
    fechaHasta,
    cajaIds,
    tipoGastoId
  ) => {
    const params = [fechaDesde, fechaHasta];
    let filtroCaja = "";
    if (Array.isArray(cajaIds) && cajaIds.length > 0) {
      params.push(cajaIds.map(Number));
      filtroCaja = `AND r."CajaId" = ANY($${params.length}::int[])`;
    }
    let filtroTipo = "";
    if (tipoGastoId) {
      params.push(Number(tipoGastoId));
      filtroTipo = `AND r."TipoGastoId" = $${params.length}`;
    }
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
        ${filtroCaja}
        ${filtroTipo}
      ORDER BY r."RegistroDiarioCajaId" ASC`,
      params
    );
    return result.rows;
  },

  getCierreDiario: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
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
        ${filtroCajas}
      GROUP BY c."CajaId", c."CajaDescripcion"
      ORDER BY c."CajaDescripcion"`,
      params
    );
    return result.rows;
  },

  getReporteIngresosEgresos: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
    const result = await db.query(
      `SELECT
        r."TipoGastoId",
        r."TipoGastoGrupoId",
        COALESCE(TRIM(tg."TipoGastoGrupoDescripcion"), 'SIN GRUPO') AS "GrupoDescripcion",
        SUM(r."RegistroDiarioCajaMonto") AS "Total",
        COUNT(*) AS "CantMovimientos"
      FROM "registrodiariocaja" r
      LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      WHERE r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        ${filtroCajas}
      GROUP BY r."TipoGastoId", r."TipoGastoGrupoId", tg."TipoGastoGrupoDescripcion"
      ORDER BY r."TipoGastoId", r."TipoGastoGrupoId"`,
      params
    );
    return result.rows;
  },

  // Movimientos Western: los grupos siguen la convención "1 WESTERN ..." (Gs.)
  // y "2 WESTERN ..." (USD con cotización); prefijo selecciona la moneda.
  // prefijos: lista de prefijos de descripción de grupo a incluir
  // (ej: ["1 WESTERN"] o ["2 WESTERN", "3 WESTERN"]).
  getReporteWestern: async (fechaDesde, fechaHasta, prefijos, cajaIds) => {
    const patrones = prefijos.map((p) => `${p}%`);
    const params = [fechaDesde, fechaHasta, patrones];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
    const result = await db.query(
      `SELECT r.*,
        c."CajaDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "registrodiariocaja" r
      JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "usuario" u ON r."UsuarioId" = u."UsuarioId"
      WHERE TRIM(tg."TipoGastoGrupoDescripcion") ILIKE ANY($3)
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        ${filtroCajas}
      ORDER BY r."TipoGastoId", r."RegistroDiarioCajaId" ASC`,
      params
    );
    return result.rows;
  },

  // Resumen "El Comercio": totales por grupo de gasto, limitado a los grupos
  // asociados (vía cajagasto) a las cajas WEPA y WEPA USD, que son las
  // operaciones que pasan por la financiera El Comercio. Incluye el
  // equivalente USD de los movimientos con cotización.
  getReporteElComercio: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
    const result = await db.query(
      `SELECT
        r."TipoGastoId",
        r."TipoGastoGrupoId",
        COALESCE(TRIM(tg."TipoGastoGrupoDescripcion"), 'SIN GRUPO') AS "GrupoDescripcion",
        SUM(r."RegistroDiarioCajaMonto") AS "Total",
        SUM(CASE WHEN r."RegistroDiarioCajaCambio" > 0
              THEN r."RegistroDiarioCajaMonto" / r."RegistroDiarioCajaCambio"
              ELSE 0 END) AS "TotalUsd",
        COUNT(*) AS "CantMovimientos"
      FROM "registrodiariocaja" r
      JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      WHERE (r."TipoGastoId", r."TipoGastoGrupoId") IN (
          SELECT cg."TipoGastoId", cg."TipoGastoGrupoId"
          FROM "cajagasto" cg
          JOIN "caja" c ON cg."CajaId" = c."CajaId"
          WHERE TRIM(c."CajaDescripcion") IN ('WEPA', 'WEPA USD')
        )
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        ${filtroCajas}
      GROUP BY r."TipoGastoId", r."TipoGastoGrupoId", tg."TipoGastoGrupoDescripcion"
      ORDER BY r."TipoGastoId", r."TipoGastoGrupoId"`,
      params
    );
    return result.rows;
  },

  // Movimientos de un grupo de gasto (por descripción, en ambos tipos:
  // egresos e ingresos). Usado por el reporte de Anticipos.
  getReporteGrupo: async (fechaDesde, fechaHasta, grupoDescripcion, cajaIds) => {
    const params = [fechaDesde, fechaHasta, grupoDescripcion];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
    const result = await db.query(
      `SELECT r.*,
        c."CajaDescripcion",
        tg."TipoGastoGrupoDescripcion",
        u."UsuarioNombre"
      FROM "registrodiariocaja" r
      JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
      LEFT JOIN "caja" c ON r."CajaId" = c."CajaId"
      LEFT JOIN "usuario" u ON r."UsuarioId" = u."UsuarioId"
      WHERE UPPER(TRIM(tg."TipoGastoGrupoDescripcion")) = UPPER(TRIM($3))
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        ${filtroCajas}
      ORDER BY r."RegistroDiarioCajaId" ASC`,
      params
    );
    return result.rows;
  },
};

module.exports = RegistroDiarioCaja;
