const db = require("../config/db");

// Conceptos de caja de cada colegio para el estado de resultados, con su
// rubro (INGRESO / RETIRO / SALARIO). El concepto propio del colegio (el de
// sus cobranzas, "Propio") es INGRESO; el resto sale de colegiogasto (sin
// repetir el propio de algún colegio, para no sumarlo dos veces).
const CTE_CONCEPTOS_RESULTADO = `WITH conceptos AS (
  SELECT "ColegioId", "TipoGastoId", "TipoGastoGrupoId", 'INGRESO' AS "Rubro", true AS "Propio"
  FROM "colegio"
  WHERE "TipoGastoId" IS NOT NULL AND "TipoGastoGrupoId" IS NOT NULL
  UNION ALL
  SELECT cg."ColegioId", cg."TipoGastoId", cg."TipoGastoGrupoId", cg."ColegioGastoRubro", false
  FROM "colegiogasto" cg
  WHERE NOT EXISTS (
    SELECT 1 FROM "colegio" c
    WHERE c."TipoGastoId" = cg."TipoGastoId" AND c."TipoGastoGrupoId" = cg."TipoGastoGrupoId"
  )
)`;

const Colegio = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "colegio"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "colegio" WHERE "ColegioId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (limit, offset, sortBy = "ColegioId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "ColegioId",
      "ColegioNombre",
      "ColegioCantCurso",
      "ColegioComision",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const query = `
      SELECT c.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "colegio" c
      LEFT JOIN "tipogasto" tg ON c."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON c."TipoGastoId" = tgg."TipoGastoId" AND c."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      ORDER BY c."${sortField}" ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "colegio"'
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
    sortBy = "ColegioId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "ColegioId",
      "ColegioNombre",
      "ColegioCantCurso",
      "ColegioComision",
      "TipoGastoId",
      "TipoGastoGrupoId",
    ];
    const allowedSortOrders = ["ASC", "DESC"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "ColegioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const searchQuery = `
      SELECT c.*,
        tg."TipoGastoDescripcion",
        tgg."TipoGastoGrupoDescripcion"
      FROM "colegio" c
      LEFT JOIN "tipogasto" tg ON c."TipoGastoId" = tg."TipoGastoId"
      LEFT JOIN "tipogastogrupo" tgg ON c."TipoGastoId" = tgg."TipoGastoId" AND c."TipoGastoGrupoId" = tgg."TipoGastoGrupoId"
      WHERE c."ColegioNombre" ILIKE $1
        OR CAST(c."ColegioId" AS TEXT) ILIKE $2
        OR CAST(c."ColegioCantCurso" AS TEXT) ILIKE $3
        OR CAST(c."TipoGastoId" AS TEXT) ILIKE $4
        OR CAST(c."TipoGastoGrupoId" AS TEXT) ILIKE $5
      ORDER BY c."${sortField}" ${order}
      LIMIT $6 OFFSET $7
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(
      searchQuery,
      [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        limit,
        offset,
      ]
    );

    const countQuery = `
      SELECT COUNT(*) as total FROM "colegio"
      WHERE "ColegioNombre" ILIKE $1
        OR CAST("ColegioId" AS TEXT) ILIKE $2
        OR CAST("ColegioCantCurso" AS TEXT) ILIKE $3
        OR CAST("TipoGastoId" AS TEXT) ILIKE $4
        OR CAST("TipoGastoGrupoId" AS TEXT) ILIKE $5
    `;

    const countResult = await db.query(
      countQuery,
      [searchValue, searchValue, searchValue, searchValue, searchValue]
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

  create: async (colegioData) => {
    const query = `
      INSERT INTO "colegio" (
        "ColegioNombre",
        "ColegioCantCurso",
        "TipoGastoId",
        "TipoGastoGrupoId",
        "ColegioComision"
      ) VALUES ($1, $2, $3, $4, $5) RETURNING "ColegioId"
    `;

    const values = [
      colegioData.ColegioNombre,
      colegioData.ColegioCantCurso || 0,
      colegioData.TipoGastoId,
      colegioData.TipoGastoGrupoId,
      Number(colegioData.ColegioComision) || 0,
    ];

    const result = await db.query(query, values);

    // Obtener el registro recién creado
    const colegio = await Colegio.getById(result.rows[0].ColegioId);
    return colegio;
  },

  update: async (id, colegioData) => {
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    // Campos editables por el usuario (excluir ColegioCantCurso que se actualiza automáticamente)
    const camposActualizables = [
      "ColegioNombre",
      "TipoGastoId",
      "TipoGastoGrupoId",
      "ColegioComision",
    ];

    camposActualizables.forEach((campo) => {
      if (
        colegioData[campo] !== undefined &&
        colegioData[campo] !== null &&
        colegioData[campo] !== ""
      ) {
        updateFields.push(`"${campo}" = $${paramIndex}`);
        paramIndex++;
        // Convertir a número si es TipoGastoId, TipoGastoGrupoId o ColegioComision
        if (
          campo === "TipoGastoId" ||
          campo === "TipoGastoGrupoId" ||
          campo === "ColegioComision"
        ) {
          values.push(Number(colegioData[campo]));
        } else {
          values.push(colegioData[campo]);
        }
      }
    });

    if (updateFields.length === 0) {
      // Si no hay campos para actualizar, devolver el colegio actual sin cambios
      const colegio = await Colegio.getById(id);
      return colegio;
    }

    values.push(id);

    const query = `
      UPDATE "colegio"
      SET ${updateFields.join(", ")}
      WHERE "ColegioId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    // Obtener el registro actualizado
    const colegio = await Colegio.getById(id);
    return colegio;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "colegio" WHERE "ColegioId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  // Conceptos del estado de resultados de un colegio (tabla colegiogasto),
  // con la descripción del grupo
  getConceptosResultado: async (colegioId) => {
    const result = await db.query(
      `SELECT cg."ColegioId", cg."TipoGastoId", cg."TipoGastoGrupoId",
        cg."ColegioGastoRubro",
        COALESCE(g."TipoGastoGrupoDescripcion", '') AS "TipoGastoGrupoDescripcion"
      FROM "colegiogasto" cg
      LEFT JOIN "tipogastogrupo" g
        ON g."TipoGastoId" = cg."TipoGastoId" AND g."TipoGastoGrupoId" = cg."TipoGastoGrupoId"
      WHERE cg."ColegioId" = $1
      ORDER BY cg."ColegioGastoRubro", g."TipoGastoGrupoDescripcion"`,
      [colegioId]
    );
    return result.rows;
  },

  // Colegio que ya usa un concepto: como concepto propio (el de sus
  // cobranzas) o en colegiogasto. null si está libre.
  getColegioDelConcepto: async (tipoGastoId, tipoGastoGrupoId) => {
    const result = await db.query(
      `SELECT c."ColegioId", c."ColegioNombre"
      FROM "colegio" c
      WHERE c."TipoGastoId" = $1 AND c."TipoGastoGrupoId" = $2
      UNION
      SELECT c."ColegioId", c."ColegioNombre"
      FROM "colegiogasto" cg
      JOIN "colegio" c ON c."ColegioId" = cg."ColegioId"
      WHERE cg."TipoGastoId" = $1 AND cg."TipoGastoGrupoId" = $2
      LIMIT 1`,
      [tipoGastoId, tipoGastoGrupoId]
    );
    return result.rows[0] || null;
  },

  addConceptoResultado: async (colegioId, tipoGastoId, tipoGastoGrupoId, rubro) => {
    await db.query(
      `INSERT INTO "colegiogasto"
        ("ColegioId", "TipoGastoId", "TipoGastoGrupoId", "ColegioGastoRubro")
      VALUES ($1, $2, $3, $4)`,
      [colegioId, tipoGastoId, tipoGastoGrupoId, rubro]
    );
  },

  deleteConceptoResultado: async (colegioId, tipoGastoId, tipoGastoGrupoId) => {
    const result = await db.query(
      `DELETE FROM "colegiogasto"
      WHERE "ColegioId" = $1 AND "TipoGastoId" = $2 AND "TipoGastoGrupoId" = $3`,
      [colegioId, tipoGastoId, tipoGastoGrupoId]
    );
    return result.rowCount > 0;
  },

  // Estado de resultados: total de registrodiariocaja por colegio y concepto,
  // con el rubro del concepto (INGRESO / RETIRO / SALARIO). El concepto propio
  // del colegio (el de sus cobranzas, "Propio") es INGRESO; el resto sale de
  // colegiogasto. Incluye los conceptos sin movimientos (Total 0).
  // Sin filtro de cajas a propósito: ingresos y salarios de un colegio pasan
  // por cajas distintas, filtrar daría un resultado parcial engañoso.
  // En el concepto propio separa lo que entró por la pantalla de cobranzas
  // (detalle con "ColegioCobranzaId:") de lo cargado a mano en la caja.
  // colegioId: opcional (vacío = todos)
  getEstadoResultados: async (fechaDesde, fechaHasta, colegioId) => {
    const params = [fechaDesde, fechaHasta, colegioId ? Number(colegioId) : null];
    const result = await db.query(
      `${CTE_CONCEPTOS_RESULTADO}
      SELECT col."ColegioId",
        col."ColegioNombre",
        k."Rubro",
        k."Propio",
        k."TipoGastoId",
        k."TipoGastoGrupoId",
        COALESCE(g."TipoGastoGrupoDescripcion", '') AS "GrupoDescripcion",
        COUNT(r."RegistroDiarioCajaId")::int AS "CantMovimientos",
        COALESCE(SUM(r."RegistroDiarioCajaMonto"), 0) AS "Total",
        COUNT(r."RegistroDiarioCajaId") FILTER (
          WHERE r."RegistroDiarioCajaDetalle" LIKE '%ColegioCobranzaId:%'
        )::int AS "CantCobranzas",
        COALESCE(SUM(r."RegistroDiarioCajaMonto") FILTER (
          WHERE r."RegistroDiarioCajaDetalle" LIKE '%ColegioCobranzaId:%'
        ), 0) AS "TotalCobranzas"
      FROM conceptos k
      JOIN "colegio" col ON col."ColegioId" = k."ColegioId"
      LEFT JOIN "tipogastogrupo" g
        ON g."TipoGastoId" = k."TipoGastoId" AND g."TipoGastoGrupoId" = k."TipoGastoGrupoId"
      LEFT JOIN "registrodiariocaja" r
        ON r."TipoGastoId" = k."TipoGastoId"
        AND r."TipoGastoGrupoId" = k."TipoGastoGrupoId"
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
      WHERE ($3::int IS NULL OR col."ColegioId" = $3::int)
      GROUP BY col."ColegioId", col."ColegioNombre", k."Rubro", k."Propio", k."TipoGastoId",
        k."TipoGastoGrupoId", g."TipoGastoGrupoDescripcion"
      ORDER BY col."ColegioNombre", k."TipoGastoId", k."TipoGastoGrupoId"`,
      params
    );
    return result.rows;
  },

  // Estado de resultados mes a mes: total por colegio, mes (YYYY-MM) y
  // rubro, con lo cargado a mano en el concepto propio (Manual). Solo
  // devuelve los meses con movimientos. colegioId: opcional (vacío = todos)
  getEstadoResultadosMensual: async (fechaDesde, fechaHasta, colegioId) => {
    const params = [fechaDesde, fechaHasta, colegioId ? Number(colegioId) : null];
    const result = await db.query(
      `${CTE_CONCEPTOS_RESULTADO}
      SELECT col."ColegioId",
        col."ColegioNombre",
        to_char(r."RegistroDiarioCajaFecha", 'YYYY-MM') AS "Mes",
        k."Rubro",
        SUM(r."RegistroDiarioCajaMonto") AS "Total",
        COALESCE(SUM(r."RegistroDiarioCajaMonto") FILTER (
          WHERE k."Propio" AND r."RegistroDiarioCajaDetalle" NOT LIKE '%ColegioCobranzaId:%'
        ), 0) AS "Manual"
      FROM conceptos k
      JOIN "colegio" col ON col."ColegioId" = k."ColegioId"
      JOIN "registrodiariocaja" r
        ON r."TipoGastoId" = k."TipoGastoId"
        AND r."TipoGastoGrupoId" = k."TipoGastoGrupoId"
        AND r."RegistroDiarioCajaFecha"::date >= $1::date
        AND r."RegistroDiarioCajaFecha"::date <= $2::date
      WHERE ($3::int IS NULL OR col."ColegioId" = $3::int)
      GROUP BY col."ColegioId", col."ColegioNombre", 3, k."Rubro"
      ORDER BY col."ColegioNombre", 3`,
      params
    );
    return result.rows;
  },
};

module.exports = Colegio;
