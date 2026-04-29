const db = require("../config/db");
const bcrypt = require("bcryptjs");

const Usuario = {
  getAll: async () => {
    const result = await db.query('SELECT * FROM "usuario"');
    return result.rows || [];
  },

  getById: async (id) => {
    const result = await db.query(
      'SELECT * FROM "usuario" WHERE "UsuarioId" = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  findByUsuarioId: async (email) => {
    const result = await db.query(
      'SELECT * FROM "usuario" WHERE "UsuarioId" = $1 LIMIT 1',
      [email]
    );
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return result.rows[0];
  },

  // getAllPaginated
  getAllPaginated: async (limit, offset, sortBy = "UsuarioId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "UsuarioId",
      "UsuarioNombre",
      "UsuarioApellido",
      "UsuarioCorreo",
      "UsuarioIsAdmin",
      "UsuarioEstado",
      "LocalId",
      "LocalNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "UsuarioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const orderByField = sortField === "LocalNombre"
      ? `l."${sortField}"`
      : `u."${sortField}"`;

    const query = `
      SELECT u.*, l."LocalNombre"
      FROM "usuario" u
      LEFT JOIN "local" l ON u."LocalId" = l."LocalId"
      ORDER BY ${orderByField} ${order}
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM "usuario"'
    );

    return {
      usuarios: result.rows || [],
      total: countResult.rows && countResult.rows[0] ? countResult.rows[0].total : 0,
    };
  },

  // search
  search: async (term, limit, offset, sortBy = "UsuarioId", sortOrder = "ASC") => {
    const allowedSortFields = [
      "UsuarioId",
      "UsuarioNombre",
      "UsuarioApellido",
      "UsuarioCorreo",
      "UsuarioIsAdmin",
      "UsuarioEstado",
      "LocalId",
      "LocalNombre",
    ];
    const allowedSortOrders = ["ASC", "DESC"];
    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "UsuarioId";
    const order = allowedSortOrders.includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : "ASC";

    const orderByField = sortField === "LocalNombre"
      ? `l."${sortField}"`
      : `u."${sortField}"`;

    const searchQuery = `
      SELECT u.*, l."LocalNombre"
      FROM "usuario" u
      LEFT JOIN "local" l ON u."LocalId" = l."LocalId"
      WHERE CONCAT(u."UsuarioNombre", ' ', u."UsuarioApellido") ILIKE $1
      OR u."UsuarioCorreo" ILIKE $2
      OR CAST(u."UsuarioId" AS TEXT) ILIKE $3
      OR l."LocalNombre" ILIKE $4
      ORDER BY ${orderByField} ${order}
      LIMIT $5 OFFSET $6
    `;
    const searchValue = `%${term}%`;

    const result = await db.query(
      searchQuery,
      [searchValue, searchValue, searchValue, searchValue, limit, offset]
    );

    const countQuery = `
      SELECT COUNT(*) as total FROM "usuario" u
      LEFT JOIN "local" l ON u."LocalId" = l."LocalId"
      WHERE CONCAT(u."UsuarioNombre", ' ', u."UsuarioApellido") ILIKE $1
      OR u."UsuarioCorreo" ILIKE $2
      OR CAST(u."UsuarioId" AS TEXT) ILIKE $3
      OR l."LocalNombre" ILIKE $4
    `;

    const countResult = await db.query(
      countQuery,
      [searchValue, searchValue, searchValue, searchValue]
    );

    return {
      usuarios: result.rows,
      total: countResult.rows[0]?.total || 0,
    };
  },

  create: async (usuarioData) => {
    const hashedPassword = await bcrypt.hash(
      usuarioData.UsuarioContrasena || "H4lc0n#05",
      10
    );
    const query = `
      INSERT INTO "usuario" (
        "UsuarioId",
        "UsuarioNombre",
        "UsuarioApellido",
        "UsuarioCorreo",
        "UsuarioContrasena",
        "UsuarioIsAdmin",
        "UsuarioEstado",
        "LocalId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      usuarioData.UsuarioId,
      usuarioData.UsuarioNombre,
      usuarioData.UsuarioApellido,
      usuarioData.UsuarioCorreo ?? "",
      usuarioData.UsuarioContrasena ? hashedPassword : hashedPassword,
      usuarioData.UsuarioIsAdmin,
      usuarioData.UsuarioEstado,
      usuarioData.LocalId,
    ];

    await db.query(query, values);
    return {
      UsuarioId: usuarioData.UsuarioId,
      UsuarioNombre: usuarioData.UsuarioNombre,
      UsuarioApellido: usuarioData.UsuarioApellido,
      UsuarioCorreo: usuarioData.UsuarioCorreo ?? "",
      UsuarioIsAdmin: usuarioData.UsuarioIsAdmin,
      UsuarioEstado: usuarioData.UsuarioEstado,
      LocalId: usuarioData.LocalId,
    };
  },

  update: async (id, usuarioData) => {
    // Asegurar que UsuarioCorreo nunca sea null ni undefined
    if (usuarioData.UsuarioCorreo == null) {
      usuarioData.UsuarioCorreo = "";
    }
    // Construir la consulta dinamicamente basada en los campos proporcionados
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    // Campos que pueden ser actualizados
    const camposActualizables = [
      "UsuarioNombre",
      "UsuarioApellido",
      "UsuarioCorreo",
      "UsuarioIsAdmin",
      "UsuarioEstado",
      "LocalId",
    ];

    // Si se proporciona una nueva contrasena y no esta vacia, hashearla
    if (
      usuarioData.UsuarioContrasena &&
      usuarioData.UsuarioContrasena.trim() !== ""
    ) {
      const hashedPassword = await bcrypt.hash(
        usuarioData.UsuarioContrasena,
        10
      );
      camposActualizables.push("UsuarioContrasena");
      usuarioData.UsuarioContrasena = hashedPassword;
    }

    // Construir la consulta dinamicamente
    camposActualizables.forEach((campo) => {
      if (usuarioData[campo] !== undefined) {
        updateFields.push(`"${campo}" = $${paramIndex++}`);
        values.push(usuarioData[campo]);
      }
    });

    if (updateFields.length === 0) {
      return null; // No hay campos para actualizar
    }

    // Agregar el ID al final de los valores
    values.push(id);

    const query = `
      UPDATE "usuario"
      SET ${updateFields.join(", ")}
      WHERE "UsuarioId" = $${paramIndex}
    `;

    const result = await db.query(query, values);

    if (result.rowCount === 0) {
      return null; // No se encontro el usuario
    }

    // Obtener el usuario actualizado
    const updatedUsuario = await Usuario.getById(id);
    return updatedUsuario;
  },

  delete: async (id) => {
    const result = await db.query(
      'DELETE FROM "usuario" WHERE "UsuarioId" = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  // Verificar en que tablas tiene registros asociados
  verificarRegistrosAsociados: async (id) => {
    const tablas = [
      {
        nombre: "usuarioperfil",
        campo: "UsuarioId",
        descripcion: "perfiles asignados",
      },
      {
        nombre: "registrodiariocaja",
        campo: "UsuarioId",
        descripcion: "registros diarios de caja",
      },
      {
        nombre: "clientes",
        campo: "UsuarioId",
        descripcion: "clientes creados",
      },
      {
        nombre: "compra",
        campo: "UsuarioId",
        descripcion: "compras realizadas",
      },
      {
        nombre: "venta",
        campo: "VentaUsuario",
        descripcion: "ventas realizadas",
      },
    ];

    const queries = tablas.map((tabla) => {
      const query = `SELECT COUNT(*) as cantidad FROM "${tabla.nombre}" WHERE "${tabla.campo}" = $1`;
      return db.query(query, [id]).then((result) => ({
        tabla: tabla.nombre,
        descripcion: tabla.descripcion,
        cantidad: result.rows[0]?.cantidad || 0,
      })).catch((err) => ({
        tabla: tabla.nombre,
        error: err.message,
        cantidad: 0,
      }));
    });

    const results = await Promise.all(queries);

    const errores = results.filter((r) => r.error);
    const resultados = results.filter((r) => !r.error && r.cantidad > 0);

    if (errores.length === tablas.length) {
      throw new Error(
        `Error al verificar registros: ${errores.map((e) => e.error).join(", ")}`
      );
    }

    return resultados;
  },
};

module.exports = Usuario;
