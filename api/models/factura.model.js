const db = require("../config/db");

const Factura = {
  getAll: async () => {
    const result = await db.query(
      'SELECT * FROM "factura" ORDER BY "FacturaId" DESC'
    );
    return result.rows;
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "factura" WHERE "FacturaId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  getAllPaginated: async (
    limit,
    offset,
    sortBy = "FacturaId",
    sortOrder = "DESC"
  ) => {
    const allowedSortFields = [
      "FacturaId",
      "FacturaTimbrado",
      "FacturaDesde",
      "FacturaHasta",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "FacturaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const result = await db.query(
      `SELECT * FROM "factura" ORDER BY "${sortField}" ${order} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "factura"'
    );

    return {
      facturas: result.rows,
      total: countResult.rows[0].total,
    };
  },

  search: async (term, limit, offset, sortBy = "FacturaId", sortOrder = "DESC") => {
    const allowedSortFields = [
      "FacturaId",
      "FacturaTimbrado",
      "FacturaDesde",
      "FacturaHasta",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "FacturaId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const searchTerm = `%${term}%`;

    const result = await db.query(
      `SELECT * FROM "factura"
        WHERE CAST("FacturaId" AS TEXT) ILIKE $1
        OR CAST("FacturaTimbrado" AS TEXT) ILIKE $2
        OR CAST("FacturaDesde" AS TEXT) ILIKE $3
        OR CAST("FacturaHasta" AS TEXT) ILIKE $4
        ORDER BY "${sortField}" ${order}
        LIMIT $5 OFFSET $6`,
      [searchTerm, searchTerm, searchTerm, searchTerm, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM "factura"
        WHERE CAST("FacturaId" AS TEXT) ILIKE $1
        OR CAST("FacturaTimbrado" AS TEXT) ILIKE $2
        OR CAST("FacturaDesde" AS TEXT) ILIKE $3
        OR CAST("FacturaHasta" AS TEXT) ILIKE $4`,
      [searchTerm, searchTerm, searchTerm, searchTerm]
    );

    return {
      facturas: result.rows,
      total: countResult.rows[0].total,
    };
  },

  create: async (facturaData) => {
    const { FacturaTimbrado, FacturaDesde, FacturaHasta } = facturaData;

    // Validaciones
    if (!FacturaTimbrado || FacturaTimbrado.toString().length > 8) {
      throw new Error("FacturaTimbrado no puede tener más de 8 dígitos");
    }

    if (!FacturaDesde || FacturaDesde.toString().length > 7) {
      throw new Error("FacturaDesde no puede tener más de 7 dígitos");
    }

    if (!FacturaHasta || FacturaHasta.toString().length > 7) {
      throw new Error("FacturaHasta no puede tener más de 7 dígitos");
    }

    if (parseInt(FacturaDesde) >= parseInt(FacturaHasta)) {
      throw new Error("FacturaDesde debe ser menor que FacturaHasta");
    }

    // Verificar si ya existe una factura con el mismo timbrado
    const dupCheck = await db.query(
      'SELECT COUNT(*) as count FROM "factura" WHERE "FacturaTimbrado" = $1',
      [FacturaTimbrado]
    );
    if (dupCheck.rows[0].count > 0) {
      throw new Error("Ya existe una factura con este timbrado");
    }

    // Verificar si hay superposición de rangos
    const overlapCheck = await db.query(
      `SELECT COUNT(*) as count FROM "factura"
         WHERE ("FacturaDesde" <= $1 AND "FacturaHasta" >= $2)
         OR ("FacturaDesde" <= $3 AND "FacturaHasta" >= $4)
         OR ("FacturaDesde" >= $5 AND "FacturaHasta" <= $6)`,
      [
        FacturaDesde,
        FacturaDesde,
        FacturaHasta,
        FacturaHasta,
        FacturaDesde,
        FacturaHasta,
      ]
    );
    if (overlapCheck.rows[0].count > 0) {
      throw new Error("Existe superposición con el rango de facturas");
    }

    // Insertar la nueva factura
    const result = await db.query(
      'INSERT INTO "factura" ("FacturaTimbrado", "FacturaDesde", "FacturaHasta") VALUES ($1, $2, $3) RETURNING "FacturaId"',
      [FacturaTimbrado, FacturaDesde, FacturaHasta]
    );
    return result.rows[0].FacturaId;
  },

  update: async (id, facturaData) => {
    const { FacturaTimbrado, FacturaDesde, FacturaHasta } = facturaData;

    // Validaciones
    if (!FacturaTimbrado || FacturaTimbrado.toString().length > 8) {
      throw new Error("FacturaTimbrado no puede tener más de 8 dígitos");
    }

    if (!FacturaDesde || FacturaDesde.toString().length > 7) {
      throw new Error("FacturaDesde no puede tener más de 7 dígitos");
    }

    if (!FacturaHasta || FacturaHasta.toString().length > 7) {
      throw new Error("FacturaHasta no puede tener más de 7 dígitos");
    }

    if (parseInt(FacturaDesde) >= parseInt(FacturaHasta)) {
      throw new Error("FacturaDesde debe ser menor que FacturaHasta");
    }

    // Verificar si ya existe una factura con el mismo timbrado (excluyendo la actual)
    const dupCheck = await db.query(
      'SELECT COUNT(*) as count FROM "factura" WHERE "FacturaTimbrado" = $1 AND "FacturaId" != $2',
      [FacturaTimbrado, id]
    );
    if (dupCheck.rows[0].count > 0) {
      throw new Error("Ya existe una factura con este timbrado");
    }

    // Verificar si hay superposición de rangos (excluyendo la actual)
    const overlapCheck = await db.query(
      `SELECT COUNT(*) as count FROM "factura"
         WHERE "FacturaId" != $1
         AND (("FacturaDesde" <= $2 AND "FacturaHasta" >= $3)
         OR ("FacturaDesde" <= $4 AND "FacturaHasta" >= $5)
         OR ("FacturaDesde" >= $6 AND "FacturaHasta" <= $7))`,
      [
        id,
        FacturaDesde,
        FacturaDesde,
        FacturaHasta,
        FacturaHasta,
        FacturaDesde,
        FacturaHasta,
      ]
    );
    if (overlapCheck.rows[0].count > 0) {
      throw new Error("Existe superposición con el rango de facturas");
    }

    // Actualizar la factura
    const result = await db.query(
      'UPDATE "factura" SET "FacturaTimbrado" = $1, "FacturaDesde" = $2, "FacturaHasta" = $3 WHERE "FacturaId" = $4',
      [FacturaTimbrado, FacturaDesde, FacturaHasta, id]
    );
    if (result.rowCount === 0) {
      throw new Error("Factura no encontrada");
    }
    return result;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "factura" WHERE "FacturaId" = $1',
      [id]
    );
    if (result.rowCount === 0) {
      throw new Error("Factura no encontrada");
    }
    return result;
  },

  getNextAvailableNumber: async () => {
    const result = await db.query(
      'SELECT "FacturaHasta" FROM "factura" ORDER BY "FacturaHasta" DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      // Si no hay facturas, empezar desde 1
      return 1;
    }
    // Tomar el último número usado y sumar 1
    const lastNumber = parseInt(result.rows[0].FacturaHasta);
    return lastNumber + 1;
  },

  getCurrentFactura: async (numeroFactura) => {
    const result = await db.query(
      'SELECT * FROM "factura" WHERE "FacturaDesde" <= $1 AND "FacturaHasta" >= $2',
      [numeroFactura, numeroFactura]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },
};

module.exports = Factura;
