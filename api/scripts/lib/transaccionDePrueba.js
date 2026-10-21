// Infraestructura de las pruebas de punta a punta de scripts/: corre una
// prueba contra la base configurada SIN MODIFICARLA.
//
// Todo pasa dentro de una transacción que se revierte al final (incluidas las
// migraciones de las que dependen, si faltan). El pool se reemplaza por esa
// única conexión y los BEGIN/COMMIT/ROLLBACK de los controllers se convierten
// en savepoints. Igual conviene correrlas contra la base local o una copia, no
// contra producción (mientras corren bloquean filas de caja).
//
// La prueba recibe:
//   realQuery(sql, params)  consulta dentro de la transacción
//   uno(sql, params)        primera fila
//   transaccion             "client" para pasar a modelos que aceptan uno
//   llamar(handler, req)    llama a un controller y devuelve { status, body }
//   ok(condición, texto)    registra una verificación
//   user, usuario           usuario administrador de prueba
// El proceso sale con código 1 si alguna verificación falla.
const fs = require("fs");
const path = require("path");
const db = require("../../config/db");

const API = path.join(__dirname, "..", "..");

const conTransaccionDePrueba = async (prueba) => {
  let fallas = 0;
  const ok = (cond, msg) => {
    if (!cond) fallas++;
    console.log(cond ? "  OK   " : "  FALLA", msg);
  };

  const outer = await db.connect();
  const realQuery = outer.query.bind(outer);
  let sp = 0;
  const transaccion = {
    query: (text, params) => {
      const t = typeof text === "string" ? text.trim().toUpperCase() : "";
      if (t === "BEGIN") return realQuery(`SAVEPOINT s${++sp}`);
      if (t === "COMMIT") return realQuery(`RELEASE SAVEPOINT s${sp--}`);
      if (t === "ROLLBACK") {
        if (sp === 0) return Promise.resolve();
        const n = sp--;
        return realQuery(`ROLLBACK TO SAVEPOINT s${n}`).then(() =>
          realQuery(`RELEASE SAVEPOINT s${n}`)
        );
      }
      return realQuery(text, params);
    },
    release() {},
  };
  await realQuery("BEGIN");
  db.query = (t, p) => realQuery(t, p);
  db.connect = async () => transaccion;

  const llamar = async (handler, req) => {
    const out = { status: 200, body: null };
    const res = {
      status(c) {
        out.status = c;
        return res;
      },
      json(b) {
        out.body = b;
        return res;
      },
    };
    await handler(req, res);
    return out;
  };
  const uno = async (sql, params) => (await realQuery(sql, params)).rows[0];

  try {
    // Migraciones de las que dependen las pruebas, si la base no las tiene
    const migrar = async (archivo) =>
      realQuery(
        fs
          .readFileSync(path.join(API, "migrations", archivo), "utf8")
          .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "")
      );
    if (!(await uno(`SELECT to_regclass('registrocorreccion') AS t`)).t) {
      await migrar("2026-10-21_registrocorreccion.sql");
    }
    const conCierreAsignado = await uno(
      `SELECT 1 AS si FROM information_schema.columns
       WHERE table_name = 'registrodiariocaja' AND column_name = 'RegistroDiarioCajaCierreId'`
    );
    if (!conCierreAsignado) await migrar("2026-10-22_registro_cierre_asignado.sql");
    const usuario = (await uno(`SELECT "UsuarioId" FROM usuario LIMIT 1`)).UsuarioId;
    const user = { id: usuario, isAdmin: "S" };
    await prueba({ realQuery, uno, transaccion, llamar, ok, user, usuario });
  } catch (e) {
    fallas++;
    console.error("ERROR", e);
  } finally {
    await realQuery("ROLLBACK");
    outer.release();
    await db.end();
    console.log(fallas ? `\n${fallas} verificación(es) fallida(s)` : "\nTodo OK (la base quedó sin cambios)");
    process.exit(fallas ? 1 : 0);
  }
};

module.exports = { conTransaccionDePrueba };
