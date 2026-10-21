const db = require("../config/db");
const CierreDiferencia = require("./cierrediferencia.model");
const { esRegistroPagoAdmin } = require("../utils/ajusteCajas");

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

// Día (YYYY-MM-DD) de una fecha en Paraguay. Lo que llega del frontend
// ("YYYY-MM-DD" o "YYYY-MM-DDTHH:mm") ya es hora de Paraguay y se toma tal cual;
// un Date (lo que guarda el servidor, ej. la apertura) se pasa a la zona de
// Paraguay para no depender del huso del servidor. Sin valor: hoy.
function diaParaguay(value) {
  const str = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(str)) {
    return str.slice(0, 10);
  }
  const d = !value ? new Date() : value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
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

// TipoGastoId: 1 = egreso, 2 = ingreso. El grupo 2 marca las filas de turno:
// la apertura es un ingreso de ese grupo y el cierre un egreso.
const EGRESO = 1;
const INGRESO = 2;
const GRUPO_TURNO = 2;

// Marcadores que dejan en el detalle los movimientos creados junto con otra
// tabla, y dónde se corrigen
const ORIGENES_VINCULADOS = [
  ["ColegioCobranzaId:", "una cobranza de colegio: corregila desde Cobranzas de Colegios"],
  ["JSICobroId:", "un cobro de la Junta de Saneamiento"],
  ["PagoTransId:", "un pago de transporte"],
  ["DivisaMovimientoId:", "un movimiento de divisas"],
  ["PagoAdminId:", "un pago admin"],
];

// Orígenes con pantalla propia para eliminar: esa pantalla borra el cobro y su
// registro de caja juntos, con su regla de saldos. Borrar sólo el registro
// desde Registro Diario dejaría el cobro huérfano.
const ORIGENES_CON_PANTALLA = [
  ["ColegioCobranzaId:", "una cobranza de colegio", "Admin. Colegios > Cobranzas"],
  ["JSICobroId:", "un cobro de JSI", "Registro Diario > Cobros JSI"],
  ["PagoTransId:", "un pago de transporte", "Transporte > Pagos Transporte"],
];

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
        `SELECT "CajaId", "CajaDescripcion", "CajaTipoId" FROM "caja"
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

      // Las cajas internas (tipo 1) trabajan por turnos de apertura/cierre y
      // el ticket de cierre sólo suma lo registrado entre ambos. Un pase a una
      // caja interna cerrada queda fuera de todo turno: la plata se cuenta en
      // el arqueo del turno siguiente pero el movimiento no, y aparece como
      // sobrante (o faltante, si la cerrada es la de origen). Una caja interna
      // que nunca tuvo apertura (ej. CAJA USD) no trabaja por turnos y no se
      // valida.
      for (const caja of [cajaOrigen, cajaDestino]) {
        if (Number(caja.CajaTipoId) !== 1) continue;
        const estado = await client.query(
          `SELECT
             (SELECT MAX("RegistroDiarioCajaId") FROM "registrodiariocaja"
               WHERE "CajaId" = $1 AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2) AS apertura,
             (SELECT MAX("RegistroDiarioCajaId") FROM "registrodiariocaja"
               WHERE "CajaId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2) AS cierre`,
          [caja.CajaId]
        );
        const aperturaId = Number(estado.rows[0].apertura) || 0;
        const cierreId = Number(estado.rows[0].cierre) || 0;
        if (aperturaId > 0 && aperturaId <= cierreId) {
          throw new Error(
            `${caja.CajaDescripcion.trim()} está cerrada. Debe realizar la apertura antes de registrar el pase.`
          );
        }
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

  // `q` permite correr la consulta dentro de una transacción (client de pg)
  delete: async (id, q = db) => {
    const result = await q.query(
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
  // `q` permite correr la consulta dentro de una transacción (client de pg)
  findByWesternEnvio: async (cajaId, tipoGastoId, tipoGastoGrupoId, fecha, monto, q = db) => {
    const result = await q.query(
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

  // `q` permite correr la consulta dentro de una transacción (client de pg)
  getUltimaApertura: async (cajaId, q = db) => {
    const result = await q.query(
      `SELECT * FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = ${INGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO} ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [cajaId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getUltimoCierre: async (cajaId, q = db) => {
    const result = await q.query(
      `SELECT * FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = ${EGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO} ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [cajaId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  // Por qué un movimiento no se puede corregir desde Registro Diario de Caja
  // (null si se puede). `registro` tiene que traer TipoGastoGrupoDescripcion
  // (el listado y la corrección la traen con el JOIN a tipogastogrupo). Los
  // movimientos atados a otra tabla o a la contraparte de un pase no se
  // corrigen acá: cambiar sólo el monto del registro los desincroniza.
  motivoNoCorregible: (registro) => {
    if (Number(registro.TipoGastoGrupoId) === GRUPO_TURNO) {
      return "Las filas de apertura y cierre de turno no se corrigen.";
    }
    const detalle = registro.RegistroDiarioCajaDetalle || "";
    const vinculo = ORIGENES_VINCULADOS.find(([marca]) => detalle.includes(marca));
    if (vinculo) return `El movimiento pertenece a ${vinculo[1]}.`;
    if (esRegistroPagoAdmin(registro)) return "El movimiento pertenece a un pago admin.";
    const grupo = String(registro.TipoGastoGrupoDescripcion || "").trim().toUpperCase();
    if (grupo.startsWith("PASE ")) {
      return "Los pases entre cajas no se corrigen: eliminá el pase y volvé a registrarlo.";
    }
    if (grupo.includes("WESTERN")) {
      return "Los movimientos Western están vinculados al envío/pago y no se corrigen desde acá.";
    }
    return null;
  },

  // Por qué un movimiento no se puede eliminar desde Registro Diario de Caja
  // (null si se puede): los de un cobro con pantalla propia se eliminan desde
  // ahí. Los Western, desde Registro Diario > Western, que borra también el
  // registro de westernenvio (si no, queda huérfano). `registro` tiene que
  // traer TipoGastoGrupoDescripcion. Los de divisas sí pasan por acá: su
  // pantalla usa este mismo borrado.
  motivoNoEliminable: (registro) => {
    const detalle = registro.RegistroDiarioCajaDetalle || "";
    const origen = ORIGENES_CON_PANTALLA.find(([marca]) => detalle.includes(marca));
    if (origen) {
      return `El movimiento es de ${origen[1]}: eliminalo desde ${origen[2]}, que borra el cobro y su registro de caja juntos.`;
    }
    if (String(registro.TipoGastoGrupoDescripcion || "").toUpperCase().includes("WESTERN")) {
      return "El movimiento es Western: eliminalo (o reclasificalo) desde Registro Diario > Western, que actualiza también el registro del envío/pago.";
    }
    return null;
  },

  // Cierre del turno ya cerrado al que pertenece un movimiento: la primera
  // fila de turno de su caja posterior al movimiento, si es un CIERRE (el turno
  // se arma por rango de IDs, igual que el ticket y las diferencias). Devuelve
  // null si el turno sigue abierto, si el movimiento quedó fuera de todo turno,
  // si la caja no trabaja por turnos o si el registro es una fila de turno.
  getCierreDeTurnoCerrado: async (registro, q = db) => {
    if (Number(registro.TipoGastoGrupoId) === GRUPO_TURNO) return null;
    // Agregado después a un cierre anterior: pertenece a ese turno
    if (registro.RegistroDiarioCajaCierreId) {
      return Number(registro.RegistroDiarioCajaCierreId);
    }
    const result = await q.query(
      `SELECT "RegistroDiarioCajaId", "TipoGastoId" FROM "registrodiariocaja"
       WHERE "CajaId" = $1 AND "TipoGastoGrupoId" = ${GRUPO_TURNO}
         AND "RegistroDiarioCajaId" > $2
       ORDER BY "RegistroDiarioCajaId" LIMIT 1`,
      [registro.CajaId, registro.RegistroDiarioCajaId]
    );
    const siguiente = result.rows[0];
    return siguiente && Number(siguiente.TipoGastoId) === EGRESO
      ? Number(siguiente.RegistroDiarioCajaId)
      : null;
  },

  // Inserta un movimiento olvidado en un turno ya cerrado: queda asignado a
  // ese cierre (RegistroDiarioCajaCierreId), con la caja y la fecha del cierre,
  // y cuenta en su ticket y su diferencia, no en el turno en curso. `cierre`
  // es la fila CIERRE. No toca saldos ni recalcula la diferencia (lo hace quien
  // llama, dentro de su transacción `q`).
  crearEnCierreAnterior: async (
    q,
    { cierre, TipoGastoId, TipoGastoGrupoId, Monto, Detalle, UsuarioId, Cambio = 0, MTCN = 0, CargoEnvio = 0 }
  ) => {
    const result = await q.query(
      `INSERT INTO "registrodiariocaja" (
         "CajaId", "RegistroDiarioCajaFecha", "TipoGastoId", "TipoGastoGrupoId",
         "RegistroDiarioCajaCambio", "RegistroDiarioCajaDetalle", "RegistroDiarioCajaMTCN",
         "RegistroDiarioCajaCargoEnvio", "RegistroDiarioCajaMonto", "RegistroDiarioCajaPendiente1",
         "RegistroDiarioCajaPendiente2", "RegistroDiarioCajaPendiente3", "RegistroDiarioCajaPendiente4",
         "UsuarioId", "RegistroDiarioCajaCierreId"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, 0, 0, $10, $11)
       RETURNING *`,
      [
        cierre.CajaId,
        cierre.RegistroDiarioCajaFecha,
        TipoGastoId,
        TipoGastoGrupoId,
        Cambio,
        Detalle,
        MTCN,
        CargoEnvio,
        Monto,
        UsuarioId,
        cierre.RegistroDiarioCajaId,
      ]
    );
    return result.rows[0];
  },

  // Último cierre de la caja en el día (de Paraguay) de `fecha`, para cargar en
  // él un movimiento que faltó. Sólo mira los últimos `dias` días. Devuelve la
  // fila CIERRE o null.
  getCierreDelDia: async (cajaId, fecha, { dias = 7 } = {}, q = db) => {
    const dia = diaParaguay(fecha);
    if (!dia) return null;
    const result = await q.query(
      `SELECT * FROM "registrodiariocaja"
       WHERE "CajaId" = $1 AND "TipoGastoId" = ${EGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO}
         AND "RegistroDiarioCajaFecha" >= now() - ($2::int + 1) * interval '1 day'
       ORDER BY "RegistroDiarioCajaId" DESC`,
      [cajaId, dias]
    );
    return result.rows.find((c) => diaParaguay(c.RegistroDiarioCajaFecha) === dia) || null;
  },

  // Rechaza (Error con status 400) un movimiento fechado antes del día en que
  // se abrió el turno en curso de la caja. Le tocaría un ID dentro del turno
  // abierto y lo descuadraría con plata que ya se contó en un cierre anterior.
  // Un movimiento de un turno cerrado se corrige o se elimina (eso recalcula
  // la diferencia de ese cierre), no se vuelve a cargar con fecha atrasada.
  // No valida si la caja no tiene un turno abierto.
  validarFechaEnTurno: async (cajaId, fecha) => {
    if (!cajaId) return;
    const apertura = await RegistroDiarioCaja.getUltimaApertura(cajaId);
    if (!apertura) return;
    const cierre = await RegistroDiarioCaja.getUltimoCierre(cajaId);
    if (cierre && cierre.RegistroDiarioCajaId > apertura.RegistroDiarioCajaId) {
      return;
    }
    const diaMovimiento = diaParaguay(fecha);
    const diaApertura = diaParaguay(apertura.RegistroDiarioCajaFecha);
    if (diaMovimiento && diaApertura && diaMovimiento < diaApertura) {
      const formato = (dia) => dia.split("-").reverse().join("/");
      // codigo TURNO_CERRADO: las pestañas de Cobranza y JSI ofrecen cargarlo
      // en el cierre de ese día (POST /registrodiariocaja/en-cierre-anterior)
      throw Object.assign(
        new Error(
          `La fecha ${formato(diaMovimiento)} es anterior a la apertura del turno en curso de la caja (${formato(diaApertura)}). ` +
            "No se carga con fecha atrasada porque caería en el turno de hoy. Si es un movimiento que faltó en un cierre anterior, desde Cobranza o JSI se puede cargar en ese cierre; en otros casos, un supervisor lo agrega desde Diferencias de Cierre. Si está mal cargado, se corrige o elimina desde su pantalla."
        ),
        { status: 400, codigo: "TURNO_CERRADO", dia: diaMovimiento }
      );
    }
  },

  // Apertura (apertura = 0) o cierre (apertura = 1) de turno, atómico: valida
  // el estado, inserta la fila del turno y (en el cierre) fija CajaMonto en
  // una sola transacción. Bloquea primero al usuario (lock advisory) y después
  // la fila de la caja, siempre en ese orden, para que dos pedidos simultáneos
  // no puedan abrir/cerrar dos veces ni dejar al usuario con dos cajas
  // abiertas. Errores de negocio: lanza un Error con `status = 400`.
  aperturaCierre: async ({ apertura, CajaId, Monto, pendientes = [], UsuarioId }) => {
    const errorNegocio = (message) =>
      Object.assign(new Error(message), { status: 400 });
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `turno-usuario:${UsuarioId}`,
      ]);
      const cajaResult = await client.query(
        'SELECT * FROM "caja" WHERE "CajaId" = $1 FOR UPDATE',
        [CajaId]
      );
      const caja = cajaResult.rows[0];
      if (!caja) throw errorNegocio("Caja no encontrada");
      const CajaDescripcion = caja.CajaDescripcion || "";

      const aperturaReg = await RegistroDiarioCaja.getUltimaApertura(CajaId, client);
      const cierreReg = await RegistroDiarioCaja.getUltimoCierre(CajaId, client);
      const aperturaId = aperturaReg ? aperturaReg.RegistroDiarioCajaId : 0;
      const cierreId = cierreReg ? cierreReg.RegistroDiarioCajaId : 0;
      const fecha = new Date();

      if (apertura == 0) {
        if (aperturaId !== 0 && cierreId < aperturaId) {
          throw errorNegocio("CAJA ABIERTA - DEBE REALIZAR EL CIERRE");
        }
        // El usuario no puede aperturar si ya tiene OTRA caja abierta
        const estadoUsuario = await RegistroDiarioCaja.getEstadoAperturaPorUsuario(
          UsuarioId,
          client
        );
        if (estadoUsuario.cajaId && estadoUsuario.aperturaId > estadoUsuario.cierreId) {
          throw errorNegocio(
            `USTED YA TIENE ABIERTA LA CAJA ${estadoUsuario.cajaId} - DEBE REALIZAR EL CIERRE`
          );
        }
        // Se abre con el monto del último cierre de la caja — lo que realmente
        // quedó en el cajón según el arqueo, incluido el sobrante o faltante
        // con el que se cerró. Si nunca se cerró, se usa el CajaMonto inicial.
        const montoApertura = cierreReg
          ? Number(cierreReg.RegistroDiarioCajaMonto) || 0
          : Number(caja.CajaMonto) || 0;
        await client.query(INSERT_REGISTRO_QUERY, [
          CajaId, fecha, INGRESO, GRUPO_TURNO, 0,
          "APERTURA " + CajaDescripcion, 0, 0, montoApertura,
          0, 0, 0, 0, UsuarioId,
        ]);
        // CajaMonto en la tabla Caja no se modifica (queda fijo)
      } else {
        if (!(cierreId < aperturaId)) {
          throw errorNegocio("CAJA CERRADA - DEBE REALIZAR LA APERTURA");
        }
        const cierreResult = await client.query(INSERT_REGISTRO_QUERY, [
          CajaId, fecha, EGRESO, GRUPO_TURNO, 0,
          "CIERRE " + CajaDescripcion, 0, 0, Monto,
          pendientes[0] || 0, pendientes[1] || 0, pendientes[2] || 0, pendientes[3] || 0,
          UsuarioId,
        ]);
        // Se guarda el sobrante/faltante del turno para revisarlo después
        await CierreDiferencia.registrarParaCierre(
          client,
          cierreResult.rows[0].RegistroDiarioCajaId
        );
        // Durante el turno cada movimiento va ajustando CajaMonto (saldo
        // teórico). Al cerrar, la caja queda con lo que se contó en el arqueo
        // (efectivo + pendientes, el mismo "Cierre" del ticket), así Gestión de
        // Cajas, el Cierre Diario y la próxima apertura muestran el mismo monto
        // y el sobrante/faltante no se sigue arrastrando de un turno al otro.
        await client.query('UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2', [
          Monto,
          CajaId,
        ]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

  getEstadoAperturaPorUsuario: async (usuarioId, q = db) => {
    // Busca, por caja, la ultima apertura del usuario que NO tenga un cierre
    // posterior sobre esa misma caja. Se evalua por caja (y no solo la
    // ultima apertura vs. el ultimo cierre del usuario) para que una caja
    // que quedo abierta no se "tape" con la apertura/cierre de otra caja.
    const abiertaResult = await q.query(
      `SELECT a."RegistroDiarioCajaId", a."CajaId"
       FROM "registrodiariocaja" a
       WHERE a."UsuarioId" = $1
         AND a."TipoGastoId" = ${INGRESO}
         AND a."TipoGastoGrupoId" = ${GRUPO_TURNO}
         AND NOT EXISTS (
           SELECT 1 FROM "registrodiariocaja" c
           WHERE c."CajaId" = a."CajaId"
             AND c."TipoGastoId" = ${EGRESO}
             AND c."TipoGastoGrupoId" = ${GRUPO_TURNO}
             AND c."RegistroDiarioCajaId" > a."RegistroDiarioCajaId"
         )
       ORDER BY a."RegistroDiarioCajaId" ASC
       LIMIT 1`,
      [usuarioId]
    );
    const abierta = abiertaResult.rows[0];

    if (abierta) {
      // Ultimo cierre de esa caja (siempre menor a la apertura, por definicion)
      const cierreResult = await q.query(
        `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "CajaId" = $1 AND "TipoGastoId" = ${EGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO} AND "RegistroDiarioCajaId" < $2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
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
    const aperturasResult = await q.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = ${INGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO} ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId]
    );
    const cierresResult = await q.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = ${EGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO} ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
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
  // Último turno cerrado del usuario en una caja, para el ticket de cierre:
  // su último cierre, la apertura previa a ese cierre y TODOS los registros de
  // la caja entre ambos (sin filtrar usuario, para incluir los PASE recibidos),
  // más los agregados después a ese cierre (RegistroDiarioCajaCierreId) y sin
  // los que, aunque caigan en el rango, se asignaron a otro cierre.
  // Devuelve undefined si no hay cierre o no hay apertura antes del cierre.
  getTurnoCierre: async (usuarioId, cajaId) => {
    const cierre = await db.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja"
       WHERE "UsuarioId" = $1 AND "CajaId" = $2
         AND "TipoGastoId" = ${EGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO}
       ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId, cajaId]
    );
    const cierreId = cierre.rows[0]?.RegistroDiarioCajaId;
    if (!cierreId) return undefined;
    const apertura = await db.query(
      `SELECT "RegistroDiarioCajaId" FROM "registrodiariocaja"
       WHERE "UsuarioId" = $1 AND "CajaId" = $2
         AND "TipoGastoId" = ${INGRESO} AND "TipoGastoGrupoId" = ${GRUPO_TURNO}
         AND "RegistroDiarioCajaId" < $3
       ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
      [usuarioId, cajaId, cierreId]
    );
    const aperturaId = apertura.rows[0]?.RegistroDiarioCajaId;
    if (!aperturaId) return undefined;
    const registros = await db.query(
      `SELECT r.*,
         t."TipoGastoDescripcion",
         tg."TipoGastoGrupoDescripcion"
       FROM "registrodiariocaja" r
       LEFT JOIN "tipogasto" t ON r."TipoGastoId" = t."TipoGastoId"
       LEFT JOIN "tipogastogrupo" tg ON r."TipoGastoId" = tg."TipoGastoId" AND r."TipoGastoGrupoId" = tg."TipoGastoGrupoId"
       WHERE r."CajaId" = $1
         AND ((r."RegistroDiarioCajaId" BETWEEN $2 AND $3 AND r."RegistroDiarioCajaCierreId" IS NULL)
              OR r."RegistroDiarioCajaCierreId" = $3)
       ORDER BY r."RegistroDiarioCajaId"`,
      [cajaId, aperturaId, cierreId]
    );
    return { aperturaId, cierreId, registros: registros.rows };
  },

  // Saldo teórico de una caja desde su apertura hasta ahora: misma fórmula que
  // el ticket de cierre y el reporte de Registro Diario (apertura + ingresos -
  // egresos, sin contar los registros de apertura/cierre, grupo 2). Se toma
  // por CajaId, sin filtrar usuario, para incluir los PASE de otras cajas. No
  // cuenta los movimientos agregados a un cierre anterior.
  getSaldoTeorico: async (aperturaId, cajaId) => {
    const result = await db.query(
      `SELECT
         (SELECT "RegistroDiarioCajaMonto" FROM "registrodiariocaja"
           WHERE "RegistroDiarioCajaId" = $1) AS apertura,
         COALESCE(SUM(CASE WHEN "TipoGastoId" = ${INGRESO} THEN "RegistroDiarioCajaMonto" END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN "TipoGastoId" = ${EGRESO} THEN "RegistroDiarioCajaMonto" END), 0) AS egresos
       FROM "registrodiariocaja"
       WHERE "CajaId" = $2
         AND "RegistroDiarioCajaId" > $1
         AND "TipoGastoGrupoId" <> ${GRUPO_TURNO}
         AND "RegistroDiarioCajaCierreId" IS NULL`,
      [aperturaId, cajaId]
    );
    const row = result.rows[0];
    const apertura = Number(row.apertura) || 0;
    const ingresos = Number(row.ingresos) || 0;
    const egresos = Number(row.egresos) || 0;
    return {
      apertura,
      ingresos,
      egresos,
      saldoTeorico: apertura + ingresos - egresos,
    };
  },

  // Caja del usuario: la que tiene abierta o, si no tiene ninguna, la de su
  // última apertura. Devuelve undefined si el usuario nunca abrió una caja.
  getCajaDelUsuario: async (usuarioId) => {
    const estado = await RegistroDiarioCaja.getEstadoAperturaPorUsuario(
      usuarioId
    );
    let cajaId = estado.cajaId;
    if (!cajaId) {
      const ultima = await db.query(
        `SELECT "CajaId" FROM "registrodiariocaja" WHERE "UsuarioId" = $1 AND "TipoGastoId" = 2 AND "TipoGastoGrupoId" = 2 ORDER BY "RegistroDiarioCajaId" DESC LIMIT 1`,
        [usuarioId]
      );
      cajaId = ultima.rows[0]?.CajaId;
    }
    if (!cajaId) return undefined;
    const caja = await db.query(
      `SELECT "CajaId", "CajaDescripcion" FROM "caja" WHERE "CajaId" = $1`,
      [cajaId]
    );
    return caja.rows[0];
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

  // Ingresos/egresos por caja en el rango. Excluye las filas de apertura y
  // cierre de turno (grupo 2): antes la apertura sumaba como ingreso y el
  // cierre como egreso, y el "Saldo" terminaba siendo el faltante del arqueo.
  // Ahora Saldo = neto de los movimientos reales, misma regla que el ticket.
  getCierreDiario: async (fechaDesde, fechaHasta, cajaIds) => {
    const params = [fechaDesde, fechaHasta];
    const filtroCajas = filtroCajasSql(params, cajaIds, 'r."CajaId"');
    const result = await db.query(
      `SELECT
        c."CajaId",
        c."CajaDescripcion",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = ${INGRESO} THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "TotalIngresos",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = ${EGRESO} THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "TotalEgresos",
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = ${INGRESO} THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN r."TipoGastoId" = ${EGRESO} THEN r."RegistroDiarioCajaMonto" ELSE 0 END), 0) AS "Saldo",
        COUNT(*) AS "CantMovimientos"
      FROM "registrodiariocaja" r
      JOIN "caja" c ON r."CajaId" = c."CajaId"
      WHERE r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
        AND r."TipoGastoGrupoId" <> ${GRUPO_TURNO}
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
