const db = require("../config/db");

// Diferencias de cierre de caja: una fila por cada CIERRE de turno con el
// sobrante/faltante, con la misma fórmula que el ticket de cierre:
//   teórico    = apertura + ingresos - egresos (sin las filas de turno, grupo 2)
//   diferencia = teórico - contado   (> 0 faltante, < 0 sobrante)
// Se toman los movimientos de la caja entre la apertura y el cierre, de
// cualquier usuario (así entran los PASE recibidos), igual que el ticket.

const SELECT_LISTADO = `
  SELECT
    d."RegistroDiarioCajaId" AS "Id",
    to_char(d."CierreDiferenciaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha",
    d."CajaId",
    TRIM(c."CajaDescripcion") AS "CajaDescripcion",
    d."UsuarioId",
    TRIM(CONCAT(u."UsuarioNombre", ' ', u."UsuarioApellido")) AS "UsuarioNombre",
    d."CierreDiferenciaApertura"::numeric AS "Apertura",
    d."CierreDiferenciaIngresos"::numeric AS "Ingresos",
    d."CierreDiferenciaEgresos"::numeric AS "Egresos",
    d."CierreDiferenciaTeorico"::numeric AS "Teorico",
    d."CierreDiferenciaContado"::numeric AS "Contado",
    d."CierreDiferenciaMonto"::numeric AS "Diferencia",
    d."CierreDiferenciaObservacion" AS "Observacion",
    d."CierreDiferenciaRevisado" AS "Revisado",
    d."CierreDiferenciaRevisadoPor" AS "RevisadoPor",
    to_char(d."CierreDiferenciaRevisadoFecha", 'YYYY-MM-DD HH24:MI') AS "RevisadoFecha"
  FROM "cierrediferencia" d
  JOIN "caja" c ON c."CajaId" = d."CajaId"
  LEFT JOIN "usuario" u ON u."UsuarioId" = d."UsuarioId"
`;

// Columnas por las que se puede ordenar (nombre expuesto -> expresión)
const ORDEN = {
  Fecha: `d."CierreDiferenciaFecha"`,
  CajaDescripcion: `c."CajaDescripcion"`,
  UsuarioNombre: `u."UsuarioNombre"`,
  Teorico: `d."CierreDiferenciaTeorico"`,
  Contado: `d."CierreDiferenciaContado"`,
  Diferencia: `d."CierreDiferenciaMonto"`,
};

const CierreDiferencia = {
  // Calcula y guarda la diferencia del cierre `cierreId` (fila CIERRE ya
  // insertada). `q` es el client de la transacción del cierre.
  registrarParaCierre: async (q, cierreId) => {
    await q.query(
      `INSERT INTO "cierrediferencia" (
         "RegistroDiarioCajaId", "CierreDiferenciaAperturaId", "CajaId", "UsuarioId",
         "CierreDiferenciaFecha", "CierreDiferenciaApertura", "CierreDiferenciaIngresos",
         "CierreDiferenciaEgresos", "CierreDiferenciaTeorico", "CierreDiferenciaContado",
         "CierreDiferenciaMonto"
       )
       SELECT
         c."RegistroDiarioCajaId", ap."RegistroDiarioCajaId", c."CajaId", c."UsuarioId",
         c."RegistroDiarioCajaFecha", ap."RegistroDiarioCajaMonto", m.ingresos, m.egresos,
         ap."RegistroDiarioCajaMonto" + m.ingresos - m.egresos,
         c."RegistroDiarioCajaMonto",
         ap."RegistroDiarioCajaMonto" + m.ingresos - m.egresos - c."RegistroDiarioCajaMonto"
       FROM "registrodiariocaja" c
       JOIN LATERAL (
         SELECT a."RegistroDiarioCajaId", a."RegistroDiarioCajaMonto"
         FROM "registrodiariocaja" a
         WHERE a."CajaId" = c."CajaId" AND a."TipoGastoId" = 2 AND a."TipoGastoGrupoId" = 2
           AND a."RegistroDiarioCajaId" < c."RegistroDiarioCajaId"
         ORDER BY a."RegistroDiarioCajaId" DESC LIMIT 1
       ) ap ON TRUE
       JOIN LATERAL (
         SELECT
           COALESCE(SUM(CASE WHEN r."TipoGastoId" = 2 THEN r."RegistroDiarioCajaMonto" END), 0) AS ingresos,
           COALESCE(SUM(CASE WHEN r."TipoGastoId" = 1 THEN r."RegistroDiarioCajaMonto" END), 0) AS egresos
         FROM "registrodiariocaja" r
         WHERE r."CajaId" = c."CajaId" AND r."TipoGastoGrupoId" <> 2
           AND r."RegistroDiarioCajaId" > ap."RegistroDiarioCajaId"
           AND r."RegistroDiarioCajaId" < c."RegistroDiarioCajaId"
       ) m ON TRUE
       WHERE c."RegistroDiarioCajaId" = $1
       ON CONFLICT DO NOTHING`,
      [cierreId]
    );
  },

  // Listado paginado con filtros y totales del filtro completo.
  // tipo: "con" (con diferencia) | "faltante" | "sobrante" | "" (todos)
  // revisado: "S" | "N" | "" (todos)
  getPaginated: async ({
    page = 1,
    limit = 10,
    fechaDesde,
    fechaHasta,
    cajaId,
    usuarioId,
    tipo,
    revisado,
    sortBy = "Fecha",
    sortOrder = "desc",
  }) => {
    const params = [];
    const where = [];
    const add = (cond, value) => {
      params.push(value);
      where.push(cond.replace("?", `$${params.length}`));
    };
    if (fechaDesde) add(`d."CierreDiferenciaFecha"::date >= ?::date`, fechaDesde);
    if (fechaHasta) add(`d."CierreDiferenciaFecha"::date <= ?::date`, fechaHasta);
    if (cajaId) add(`d."CajaId" = ?::int`, cajaId);
    if (usuarioId) add(`d."UsuarioId" = ?`, usuarioId);
    if (tipo === "con") where.push(`d."CierreDiferenciaMonto" <> 0`);
    if (tipo === "faltante") where.push(`d."CierreDiferenciaMonto" > 0`);
    if (tipo === "sobrante") where.push(`d."CierreDiferenciaMonto" < 0`);
    if (revisado === "S") where.push(`d."CierreDiferenciaRevisado"`);
    if (revisado === "N") where.push(`NOT d."CierreDiferenciaRevisado"`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const orderExpr = ORDEN[sortBy] || ORDEN.Fecha;
    const orderDir = String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    const offset = (page - 1) * limit;

    const data = await db.query(
      `${SELECT_LISTADO} ${whereSql}
       ORDER BY ${orderExpr} ${orderDir}, d."RegistroDiarioCajaId" DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const totales = (
      await db.query(
        `SELECT
           COUNT(*)::int AS "Cantidad",
           COUNT(*) FILTER (WHERE d."CierreDiferenciaMonto" > 0)::int AS "CantFaltantes",
           COUNT(*) FILTER (WHERE d."CierreDiferenciaMonto" < 0)::int AS "CantSobrantes",
           COALESCE(SUM(d."CierreDiferenciaMonto") FILTER (WHERE d."CierreDiferenciaMonto" > 0), 0)::numeric AS "TotalFaltantes",
           COALESCE(-SUM(d."CierreDiferenciaMonto") FILTER (WHERE d."CierreDiferenciaMonto" < 0), 0)::numeric AS "TotalSobrantes",
           COUNT(*) FILTER (WHERE d."CierreDiferenciaMonto" <> 0 AND NOT d."CierreDiferenciaRevisado")::int AS "CantPendientes"
         FROM "cierrediferencia" d
         JOIN "caja" c ON c."CajaId" = d."CajaId"
         LEFT JOIN "usuario" u ON u."UsuarioId" = d."UsuarioId"
         ${whereSql}`,
        params
      )
    ).rows[0];

    return {
      data: data.rows,
      totales,
      pagination: {
        totalItems: totales.Cantidad,
        totalPages: Math.max(1, Math.ceil(totales.Cantidad / limit)),
        itemsPerPage: data.rows.length,
      },
    };
  },

  // Una diferencia con los movimientos de su turno y las posibles
  // coincidencias con el monto de la diferencia, para ayudar a encontrar lo
  // que no se cargó (o se cargó mal):
  //  - en el turno, un movimiento por el mismo monto (cargado de más o dos
  //    veces) o por la mitad (cargado como ingreso en vez de egreso o al revés:
  //    eso descuadra el doble del monto);
  //  - en otra caja el mismo día, un movimiento por el mismo monto (cargado en
  //    la caja equivocada).
  // Devuelve undefined si no existe.
  getDetalle: async (id) => {
    const cabecera = (
      await db.query(`${SELECT_LISTADO} WHERE d."RegistroDiarioCajaId" = $1`, [id])
    ).rows[0];
    if (!cabecera) return undefined;
    const { "CierreDiferenciaAperturaId": aperturaId } = (
      await db.query(
        `SELECT "CierreDiferenciaAperturaId" FROM "cierrediferencia" WHERE "RegistroDiarioCajaId" = $1`,
        [id]
      )
    ).rows[0];
    const abs = Math.abs(Number(cabecera.Diferencia));

    const movimientos = (
      await db.query(
        `SELECT
           r."RegistroDiarioCajaId" AS "Id",
           to_char(r."RegistroDiarioCajaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha",
           CASE WHEN r."TipoGastoId" = 2 THEN 'INGRESO' ELSE 'EGRESO' END AS "Tipo",
           TRIM(tg."TipoGastoGrupoDescripcion") AS "Grupo",
           r."RegistroDiarioCajaDetalle" AS "Detalle",
           r."RegistroDiarioCajaMonto"::numeric AS "Monto",
           r."UsuarioId",
           r."TipoGastoGrupoId" = 2 AS "EsTurno",
           CASE
             WHEN $4::numeric = 0 OR r."TipoGastoGrupoId" = 2 THEN NULL
             WHEN r."RegistroDiarioCajaMonto" = $4 THEN 'MISMO_MONTO'
             WHEN r."RegistroDiarioCajaMonto" * 2 = $4 THEN 'MITAD'
           END AS "Coincidencia"
         FROM "registrodiariocaja" r
         LEFT JOIN "tipogastogrupo" tg
           ON tg."TipoGastoId" = r."TipoGastoId" AND tg."TipoGastoGrupoId" = r."TipoGastoGrupoId"
         WHERE r."CajaId" = $1
           AND r."RegistroDiarioCajaId" BETWEEN $2 AND $3
         ORDER BY r."RegistroDiarioCajaId"`,
        [cabecera.CajaId, aperturaId, id, abs]
      )
    ).rows;

    const otrasCajas =
      abs === 0
        ? []
        : (
            await db.query(
              `SELECT
                 r."RegistroDiarioCajaId" AS "Id",
                 to_char(r."RegistroDiarioCajaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha",
                 TRIM(c."CajaDescripcion") AS "CajaDescripcion",
                 CASE WHEN r."TipoGastoId" = 2 THEN 'INGRESO' ELSE 'EGRESO' END AS "Tipo",
                 TRIM(tg."TipoGastoGrupoDescripcion") AS "Grupo",
                 r."RegistroDiarioCajaDetalle" AS "Detalle",
                 r."RegistroDiarioCajaMonto"::numeric AS "Monto",
                 r."UsuarioId"
               FROM "registrodiariocaja" r
               JOIN "caja" c ON c."CajaId" = r."CajaId"
               LEFT JOIN "tipogastogrupo" tg
                 ON tg."TipoGastoId" = r."TipoGastoId" AND tg."TipoGastoGrupoId" = r."TipoGastoGrupoId"
               WHERE r."CajaId" <> $1
                 AND r."TipoGastoGrupoId" <> 2
                 AND r."RegistroDiarioCajaMonto" = $2
                 AND r."RegistroDiarioCajaFecha"::date = (
                   SELECT "CierreDiferenciaFecha"::date FROM "cierrediferencia"
                   WHERE "RegistroDiarioCajaId" = $3
                 )
               ORDER BY r."RegistroDiarioCajaId"
               LIMIT 50`,
              [cabecera.CajaId, abs, id]
            )
          ).rows;

    return { ...cabecera, movimientos, otrasCajas };
  },

  // Guarda la observación y el estado de revisión. Devuelve la fila o
  // undefined si no existe.
  updateRevision: async (id, { observacion, revisado }, usuarioId) => {
    const result = await db.query(
      `UPDATE "cierrediferencia" SET
         "CierreDiferenciaObservacion" = NULLIF(TRIM($2), ''),
         "CierreDiferenciaRevisado" = $3,
         "CierreDiferenciaRevisadoPor" = CASE WHEN $3 THEN $4 END,
         "CierreDiferenciaRevisadoFecha" = CASE WHEN $3 THEN now() END
       WHERE "RegistroDiarioCajaId" = $1
       RETURNING "RegistroDiarioCajaId"`,
      [id, observacion ?? "", Boolean(revisado), usuarioId]
    );
    return result.rows[0];
  },
};

module.exports = CierreDiferencia;
