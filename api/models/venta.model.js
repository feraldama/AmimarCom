const db = require("../config/db");

/**
 * Normaliza VentaFecha para que siempre incluya fecha y hora.
 * - Si no se proporciona valor: usa fecha/hora actual
 * - Si es solo fecha (YYYY-MM-DD): usa esa fecha con la hora actual del momento del registro
 * - Si es datetime completo: lo usa tal cual
 */
function normalizeVentaFecha(value) {
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

const Venta = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "venta"');
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      `SELECT v.*,
        c."ClienteNombre", c."ClienteApellido",
        a."AlmacenNombre",
        u."UsuarioNombre"
      FROM "venta" v
      LEFT JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      LEFT JOIN "almacen" a ON v."AlmacenId" = a."AlmacenId"
      LEFT JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE v."VentaId" = $1`,
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  create: async (data) => {
    const query = `INSERT INTO "venta" (
      "VentaFecha",
      "ClienteId",
      "AlmacenId",
      "VentaTipo",
      "VentaPagoTipo",
      "VentaCantidadProductos",
      "VentaUsuario",
      "Total",
      "VentaEntrega"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING "VentaId"`;

    const values = [
      normalizeVentaFecha(data.VentaFecha),
      data.ClienteId,
      data.AlmacenId,
      data.VentaTipo,
      data.VentaPagoTipo,
      data.VentaCantidadProductos,
      data.VentaUsuario,
      data.Total,
      data.VentaEntrega,
    ];

    const result = await db.query(query, values);
    const venta = await Venta.getById(result.rows[0].VentaId);
    return venta;
  },

  update: async (id, data) => {
    const query = `UPDATE "venta" SET
      "VentaFecha" = $1,
      "ClienteId" = $2,
      "AlmacenId" = $3,
      "VentaTipo" = $4,
      "VentaPagoTipo" = $5,
      "VentaCantidadProductos" = $6,
      "VentaUsuario" = $7,
      "Total" = $8,
      "VentaEntrega" = $9
      WHERE "VentaId" = $10`;

    const values = [
      normalizeVentaFecha(data.VentaFecha),
      data.ClienteId,
      data.AlmacenId,
      data.VentaTipo,
      data.VentaPagoTipo,
      data.VentaCantidadProductos,
      data.VentaUsuario,
      data.Total,
      data.VentaEntrega,
      id,
    ];

    const result = await db.query(query, values);
    if (result.rowCount === 0) return null;
    const venta = await Venta.getById(id);
    return venta;
  },

  delete: async (id) => {
    const deleteQueries = [
      // 1. Eliminar pagos de credito (ventacreditopago)
      `DELETE FROM "ventacreditopago" USING "ventacredito" WHERE "ventacreditopago"."VentaCreditoId" = "ventacredito"."VentaCreditoId" AND "ventacredito"."VentaId" = $1`,
      // 2. Eliminar registros de credito (ventacredito)
      'DELETE FROM "ventacredito" WHERE "VentaId" = $1',
      // 3. Eliminar productos de la venta (ventaproducto)
      'DELETE FROM "ventaproducto" WHERE "VentaId" = $1',
      // 4. Finalmente eliminar la venta
      'DELETE FROM "venta" WHERE "VentaId" = $1',
    ];

    for (const query of deleteQueries) {
      await db.query(query, [id]);
    }
    return true;
  },

  getAllPaginated: async (limit, offset, sortBy = "VentaId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "VentaId",
      "VentaFecha",
      "ClienteId",
      "AlmacenId",
      "VentaTipo",
      "VentaPagoTipo",
      "VentaCantidadProductos",
      "VentaUsuario",
      "Total",
      "VentaEntrega",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "VentaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const query = `
      SELECT v.*,
        c."ClienteNombre", c."ClienteApellido",
        a."AlmacenNombre",
        u."UsuarioNombre"
      FROM "venta" v
      LEFT JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      LEFT JOIN "almacen" a ON v."AlmacenId" = a."AlmacenId"
      LEFT JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      ORDER BY v."${sortField}" ${order}
      LIMIT $1 OFFSET $2`;

    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query('SELECT COUNT(*) as total FROM "venta"');

    return {
      ventas: result.rows,
      total: countResult.rows[0].total,
    };
  },

  searchVentas: async (
    term,
    limit,
    offset,
    sortBy = "VentaId",
    sortOrder = "ASC"
  ) => {
    const allowedSortFields = [
      "VentaId",
      "VentaFecha",
      "ClienteId",
      "AlmacenId",
      "VentaTipo",
      "VentaPagoTipo",
      "VentaCantidadProductos",
      "VentaUsuario",
      "Total",
      "VentaEntrega",
    ];

    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "VentaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    // Mapear terminos comunes a codigos de tipo de venta
    let tipoVentaSearch = term.toLowerCase();
    switch (tipoVentaSearch) {
      case "contado":
        tipoVentaSearch = "CO";
        break;
      case "credito":
      case "crédito":
        tipoVentaSearch = "CR";
        break;
      case "pos":
        tipoVentaSearch = "PO";
        break;
      case "transfer":
      case "transferencia":
        tipoVentaSearch = "TR";
        break;
      default:
        break;
    }

    const searchQuery = `
      SELECT v.*,
        c."ClienteNombre", c."ClienteApellido",
        a."AlmacenNombre",
        u."UsuarioNombre"
      FROM "venta" v
      LEFT JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      LEFT JOIN "almacen" a ON v."AlmacenId" = a."AlmacenId"
      LEFT JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE
        CAST(v."VentaId" AS TEXT) = $1
        OR TO_CHAR(v."VentaFecha", 'YYYY-MM-DD HH24:MI:SS') ILIKE $2
        OR LOWER(CONCAT(COALESCE(c."ClienteNombre", ''), ' ', COALESCE(c."ClienteApellido", ''))) LIKE LOWER($3)
        OR LOWER(COALESCE(a."AlmacenNombre", '')) LIKE LOWER($4)
        OR v."VentaTipo" = $5
        OR LOWER(
          CASE v."VentaTipo"
            WHEN 'CO' THEN 'contado'
            WHEN 'CR' THEN 'credito'
            WHEN 'PO' THEN 'pos'
            WHEN 'TR' THEN 'transfer'
          END
        ) LIKE LOWER($6)
        OR LOWER(v."VentaPagoTipo") LIKE LOWER($7)
        OR CAST(v."VentaCantidadProductos" AS TEXT) = $8
        OR LOWER(COALESCE(u."UsuarioNombre", '')) LIKE LOWER($9)
        OR CAST(v."Total" AS TEXT) = $10
        OR LOWER(COALESCE(v."VentaEntrega"::text, '')) LIKE LOWER($11)
      ORDER BY v."${sortField}" ${order}
      LIMIT $12 OFFSET $13
    `;

    // Para busqueda exacta de numeros
    const exactValue = term;
    // Para busqueda parcial de texto
    const likeValue = `%${term}%`;

    const values = [
      exactValue, // VentaId
      likeValue,  // VentaFecha
      likeValue,  // Cliente nombre completo
      likeValue,  // AlmacenNombre
      tipoVentaSearch, // VentaTipo (codigo exacto)
      likeValue,  // VentaTipo (nombre descriptivo)
      likeValue,  // VentaPagoTipo
      exactValue, // VentaCantidadProductos
      likeValue,  // UsuarioNombre
      exactValue, // Total
      likeValue,  // VentaEntrega
      limit,
      offset,
    ];

    const result = await db.query(searchQuery, values);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM "venta" v
      LEFT JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      LEFT JOIN "almacen" a ON v."AlmacenId" = a."AlmacenId"
      LEFT JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE
        CAST(v."VentaId" AS TEXT) = $1
        OR TO_CHAR(v."VentaFecha", 'YYYY-MM-DD HH24:MI:SS') ILIKE $2
        OR LOWER(CONCAT(COALESCE(c."ClienteNombre", ''), ' ', COALESCE(c."ClienteApellido", ''))) LIKE LOWER($3)
        OR LOWER(COALESCE(a."AlmacenNombre", '')) LIKE LOWER($4)
        OR v."VentaTipo" = $5
        OR LOWER(
          CASE v."VentaTipo"
            WHEN 'CO' THEN 'contado'
            WHEN 'CR' THEN 'credito'
            WHEN 'PO' THEN 'pos'
            WHEN 'TR' THEN 'transfer'
          END
        ) LIKE LOWER($6)
        OR LOWER(v."VentaPagoTipo") LIKE LOWER($7)
        OR CAST(v."VentaCantidadProductos" AS TEXT) = $8
        OR LOWER(COALESCE(u."UsuarioNombre", '')) LIKE LOWER($9)
        OR CAST(v."Total" AS TEXT) = $10
        OR LOWER(COALESCE(v."VentaEntrega"::text, '')) LIKE LOWER($11)
    `;

    const countValues = [
      exactValue, // VentaId
      likeValue,  // VentaFecha
      likeValue,  // Cliente nombre completo
      likeValue,  // AlmacenNombre
      tipoVentaSearch, // VentaTipo (codigo exacto)
      likeValue,  // VentaTipo (nombre descriptivo)
      likeValue,  // VentaPagoTipo
      exactValue, // VentaCantidadProductos
      likeValue,  // UsuarioNombre
      exactValue, // Total
      likeValue,  // VentaEntrega
    ];

    const countResult = await db.query(countQuery, countValues);

    return {
      ventas: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  // Obtener ventas pendientes por cliente
  getVentasPendientesPorCliente: async (clienteId, localId) => {
    let query = `
      SELECT
        v."VentaId",
        v."VentaFecha",
        CAST(v."Total" AS DECIMAL(10,2)) as "Total",
        CAST(COALESCE(v."VentaEntrega", 0) AS DECIMAL(10,2)) as "VentaEntrega",
        CAST((v."Total" - COALESCE(v."VentaEntrega", 0)) AS DECIMAL(10,2)) as "Saldo"
      FROM "venta" v
      JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE v."ClienteId" = $1
      AND v."VentaTipo" = 'CR'
    `;

    const params = [clienteId];
    let paramIndex = 2;

    // Si se proporciona localId, filtrar por el local del usuario que realizo la venta
    if (localId) {
      query += ` AND u."LocalId" = $${paramIndex}`;
      params.push(localId);
      paramIndex++;
    }

    query += ` AND (v."Total" - COALESCE(v."VentaEntrega", 0)) > 0 ORDER BY v."VentaFecha" ASC`;

    const result = await db.query(query, params);

    // Convertir explicitamente los valores a numero
    const processedResults = result.rows.map((row) => ({
      ...row,
      Total: Number(row.Total),
      VentaEntrega: Number(row.VentaEntrega),
      Saldo: Number(row.Saldo),
    }));
    return processedResults;
  },

  // Obtener deudas pendientes agrupadas por cliente
  getDeudasPendientesPorCliente: async () => {
    const query = `
      SELECT
        c."ClienteId",
        CONCAT(c."ClienteNombre", ' ', c."ClienteApellido") AS "Cliente",
        SUM(v."Total") AS "TotalVentas",
        SUM(COALESCE(v."VentaEntrega",0)) AS "TotalEntregado",
        SUM(v."Total" - COALESCE(v."VentaEntrega",0)) AS "Saldo"
      FROM "venta" v
      JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      WHERE v."VentaTipo" = 'CR'
      GROUP BY c."ClienteId", c."ClienteNombre", c."ClienteApellido"
      HAVING SUM(v."Total" - COALESCE(v."VentaEntrega",0)) > 0
      ORDER BY "Cliente"
    `;
    const result = await db.query(query);
    return result.rows;
  },

  // Obtener reporte de ventas por cliente y rango de fechas
  // Si clienteId es "TODOS", devuelve ventas de todos los clientes
  getReporteVentasPorCliente: async (clienteId, fechaDesde, fechaHasta) => {
    const esTodos = String(clienteId).toUpperCase() === "TODOS";

    let cliente;
    if (esTodos) {
      cliente = {
        ClienteId: 0,
        ClienteNombre: "TODOS",
        ClienteApellido: "",
        ClienteRUC: "",
      };
    } else {
      const clienteResult = await db.query(
        'SELECT * FROM "clientes" WHERE "ClienteId" = $1',
        [clienteId]
      );
      if (clienteResult.rows.length === 0) {
        throw new Error("Cliente no encontrado");
      }
      cliente = clienteResult.rows[0];
    }

    const ventasQuery = `
      SELECT
        v.*,
        c."ClienteNombre",
        c."ClienteApellido",
        c."ClienteRUC",
        a."AlmacenNombre",
        u."UsuarioNombre",
        v."VentaUsuario" AS "UsuarioId"
      FROM "venta" v
      LEFT JOIN "clientes" c ON v."ClienteId" = c."ClienteId"
      LEFT JOIN "almacen" a ON v."AlmacenId" = a."AlmacenId"
      LEFT JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE v."VentaFecha"::date BETWEEN $1 AND $2
      ${esTodos ? "" : 'AND v."ClienteId" = $3'}
      ORDER BY v."VentaFecha" ASC, v."VentaId" ASC
    `;

    const ventasParams = esTodos ? [fechaDesde, fechaHasta] : [fechaDesde, fechaHasta, clienteId];

    const ventasResult = await db.query(ventasQuery, ventasParams);

    // Para cada venta, si es a credito, obtener informacion de credito y pagos
    const ventasConDetalle = await Promise.all(
      ventasResult.rows.map(async (venta) => {
        const ventaDetalle = {
          ...venta,
          SaldoPendiente: 0,
          Pagos: [],
        };

        // Si es venta a credito, obtener informacion de credito
        if (venta.VentaTipo === "CR") {
          // Calcular saldo pendiente
          const total = Number(venta.Total) || 0;
          const entrega = Number(venta.VentaEntrega) || 0;
          ventaDetalle.SaldoPendiente = total - entrega;

          // Obtener informacion de credito
          const creditoResult = await db.query(
            'SELECT * FROM "ventacredito" WHERE "VentaId" = $1',
            [venta.VentaId]
          );

          if (creditoResult.rows.length > 0) {
            const ventaCreditoId = creditoResult.rows[0].VentaCreditoId;

            // Obtener pagos del credito
            const pagosResult = await db.query(
              `SELECT * FROM "ventacreditopago"
              WHERE "VentaCreditoId" = $1
              ORDER BY "VentaCreditoPagoFecha" ASC, "VentaCreditoPagoId" ASC`,
              [ventaCreditoId]
            );
            ventaDetalle.Pagos = pagosResult.rows || [];
          }
        }

        return ventaDetalle;
      })
    );

    return {
      cliente: {
        ClienteId: cliente.ClienteId,
        ClienteNombre: cliente.ClienteNombre,
        ClienteApellido: cliente.ClienteApellido,
        ClienteRUC: cliente.ClienteRUC,
      },
      fechaDesde,
      fechaHasta,
      ventas: ventasConDetalle,
    };
  },

  // ── REPORTES ──

  getVentasPorTipoPago: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT
        v."VentaTipo",
        COUNT(*) AS "CantVentas",
        COALESCE(SUM(v."Total"), 0) AS "MontoTotal",
        COALESCE(SUM(v."VentaEntrega"), 0) AS "MontoEntregado"
      FROM "venta" v
      WHERE v."VentaFecha"::date >= $1::date
        AND v."VentaFecha"::date <= $2::date
      GROUP BY v."VentaTipo"
      ORDER BY "MontoTotal" DESC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },

  getVentasPorUsuario: async (fechaDesde, fechaHasta) => {
    const result = await db.query(
      `SELECT
        u."UsuarioId",
        u."UsuarioNombre",
        u."UsuarioApellido",
        COUNT(*) AS "CantVentas",
        COALESCE(SUM(v."Total"), 0) AS "MontoTotal",
        COALESCE(SUM(CASE WHEN v."VentaTipo" = 'CO' THEN v."Total" ELSE 0 END), 0) AS "Contado",
        COALESCE(SUM(CASE WHEN v."VentaTipo" = 'CR' THEN v."Total" ELSE 0 END), 0) AS "Credito",
        COALESCE(SUM(CASE WHEN v."VentaTipo" = 'PO' THEN v."Total" ELSE 0 END), 0) AS "POS",
        COALESCE(SUM(CASE WHEN v."VentaTipo" = 'TR' THEN v."Total" ELSE 0 END), 0) AS "Transferencia"
      FROM "venta" v
      JOIN "usuario" u ON v."VentaUsuario" = u."UsuarioId"
      WHERE v."VentaFecha"::date >= $1::date
        AND v."VentaFecha"::date <= $2::date
      GROUP BY u."UsuarioId", u."UsuarioNombre", u."UsuarioApellido"
      ORDER BY "MontoTotal" DESC`,
      [fechaDesde, fechaHasta]
    );
    return result.rows;
  },
};

module.exports = Venta;
