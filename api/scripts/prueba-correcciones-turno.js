// Prueba de punta a punta de la corrección de movimientos de turnos cerrados:
// Registro Diario, cobranzas de colegio, cobros de JSI y pagos de transporte,
// llamando a los controllers reales.
//
// NO MODIFICA LA BASE: todo corre dentro de una transacción que se revierte al
// final (incluida la migración de registrocorreccion, si falta). El pool se
// reemplaza por esa única conexión y los BEGIN/COMMIT/ROLLBACK de los
// controllers se convierten en savepoints. Igual conviene correrla contra la
// base local, no contra producción (mientras corre bloquea filas de caja).
//
// Uso (desde api/):  node scripts/prueba-correcciones-turno.js
// Sale con código 1 si alguna verificación falla.
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const API = path.join(__dirname, "..");
let fallas = 0;
const ok = (cond, msg) => {
  if (!cond) fallas++;
  console.log(cond ? "  OK   " : "  FALLA", msg);
};

(async () => {
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

  try {
    const existe = (await realQuery(`SELECT to_regclass('registrocorreccion') AS t`)).rows[0].t;
    if (!existe) {
      const sql = fs
        .readFileSync(path.join(API, "migrations/2026-10-21_registrocorreccion.sql"), "utf8")
        .replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");
      await realQuery(sql);
    }

    const rdc = require("../controllers/registrodiariocaja.controller");
    const cdc = require("../controllers/cierrediferencia.controller");
    const ccc = require("../controllers/colegiocobranza.controller");
    const jsic = require("../controllers/jsicobro.controller");
    const ptc = require("../controllers/pagotrans.controller");
    const CierreDiferencia = require("../models/cierrediferencia.model");

    const uno = async (sql, params) => (await realQuery(sql, params)).rows[0];
    const usuario = (await uno(`SELECT "UsuarioId" FROM usuario LIMIT 1`)).UsuarioId;
    const user = { id: usuario, isAdmin: "S" };
    const caja = await uno(`SELECT * FROM caja WHERE "CajaTipoId" = 1 ORDER BY "CajaId" LIMIT 1`);
    const cliente = await uno(`SELECT "ClienteId" FROM clientes LIMIT 1`);
    const grupo = await uno(
      `SELECT * FROM tipogastogrupo WHERE "TipoGastoId" = 2 AND "TipoGastoGrupoId" <> 2
         AND TRIM("TipoGastoGrupoDescripcion") NOT ILIKE 'PASE %'
         AND TRIM("TipoGastoGrupoDescripcion") NOT ILIKE '%WESTERN%'
         AND "TipoGastoGrupoId" NOT IN (5, 13, 15, 24, 26, 28)
       ORDER BY "TipoGastoGrupoId" LIMIT 1`
    );
    const alumno = await uno(
      `SELECT n."NominaId", col."TipoGastoGrupoId", cur."ColegioCursoImporte"
       FROM nomina n JOIN colegio col ON col."ColegioId" = n."ColegioId"
       JOIN colegiocurso cur ON cur."ColegioId" = n."ColegioId" AND cur."ColegioCursoId" = n."ColegioCursoId"
       WHERE col."TipoGastoId" = 2 AND col."TipoGastoGrupoId" IS NOT NULL LIMIT 1`
    );
    const transporte = await uno(
      `SELECT "TransporteId", "TipoGastoId", "TipoGastoGrupoId" FROM transporte
       WHERE "TipoGastoId" = 2 AND "TipoGastoGrupoId" IS NOT NULL LIMIT 1`
    );
    const grupoJSI = await uno(
      `SELECT "TipoGastoGrupoId" FROM tipogastogrupo
       WHERE "TipoGastoId" = 2 AND TRIM("TipoGastoGrupoDescripcion") ILIKE 'J.S.I.%' LIMIT 1`
    );
    if (!caja || !cliente || !grupo || !alumno || !transporte || !grupoJSI) {
      throw new Error("Faltan datos de base (caja interna, cliente, colegio, transporte o grupo JSI)");
    }

    const INS = `INSERT INTO registrodiariocaja ("CajaId","RegistroDiarioCajaFecha","TipoGastoId","TipoGastoGrupoId",
      "RegistroDiarioCajaCambio","RegistroDiarioCajaDetalle","RegistroDiarioCajaMTCN","RegistroDiarioCajaCargoEnvio",
      "RegistroDiarioCajaMonto","RegistroDiarioCajaPendiente1","RegistroDiarioCajaPendiente2","RegistroDiarioCajaPendiente3",
      "RegistroDiarioCajaPendiente4","UsuarioId") VALUES ($1,$2,$3,$4,0,$5,0,0,$6,0,0,0,0,$7) RETURNING *`;
    const ins = async (fecha, tipo, grupoId, det, monto) =>
      (await realQuery(INS, [caja.CajaId, fecha, tipo, grupoId, det, monto, usuario])).rows[0];

    // ── Turno de "ayer" (cerrado) con un movimiento de cada origen ──
    const AYER = "2026-10-20T10:00";
    const importe = Number(alumno.ColegioCursoImporte);
    await ins(new Date("2026-10-20T11:00:00Z"), 2, 2, "APERTURA prueba", 1000000);
    const x = await ins(AYER, 2, grupo.TipoGastoGrupoId, "cargado de menos", 100000);
    const y = await ins(AYER, 2, grupo.TipoGastoGrupoId, "duplicado", 30000);
    const cob = await uno(
      `INSERT INTO colegiocobranza ("CajaId","ColegioCobranzaFecha","NominaId","ColegioCobranzaMesPagado",
         "ColegioCobranzaMes","ColegioCobranzaDiasMora","ColegioCobranzaExamen","UsuarioId","ColegioCobranzaDescuento")
       VALUES ($1,$2,$3,'OCTUBRE',1,0,0,$4,0) RETURNING *`,
      [caja.CajaId, AYER, alumno.NominaId, usuario]
    );
    const z = await ins(AYER, 2, alumno.TipoGastoGrupoId,
      `Cobranza Colegio: X - Nómina: A, B | NominaId:${alumno.NominaId} ColegioCobranzaId:${cob.ColegioCobranzaId}`, importe);
    const jsi = await uno(
      `INSERT INTO jsicobro ("CajaId","JSICobroFecha","ClienteId","JSICobroMonto","JSICobroUsuarioId")
       VALUES ($1,$2,$3,50000,$4) RETURNING *`,
      [caja.CajaId, AYER, cliente.ClienteId, usuario]
    );
    const j = await ins(AYER, 2, grupoJSI.TipoGastoGrupoId, `Cobro JSI | JSICobroId:${jsi.JSICobroId}`, 50000);
    const pago = await uno(
      `INSERT INTO pagotrans ("CajaId","PagoTransFecha","TransporteId","PagoTransFechaEmbarque","ClienteId",
         "PagoTransMonto","PagoTransUsuarioId") VALUES ($1,$2,$3,$2,$4,70000,$5) RETURNING *`,
      [caja.CajaId, AYER, transporte.TransporteId, cliente.ClienteId, usuario]
    );
    const t = await ins(AYER, 2, transporte.TipoGastoGrupoId,
      `Pago transporte | PagoTransId:${pago.PagoTransId} TransporteId:${transporte.TransporteId}`, 70000);
    const contado = 1000000 + 150000 + importe + 50000 + 70000;
    const c1 = await ins(new Date("2026-10-20T22:00:00Z"), 1, 2, "CIERRE prueba", contado);
    await CierreDiferencia.registrarParaCierre(transaccion, c1.RegistroDiarioCajaId);
    await realQuery(`UPDATE caja SET "CajaMonto" = $2 WHERE "CajaId" = $1`, [caja.CajaId, contado]);
    // ── Turno de "hoy" (abierto) ──
    await ins(new Date("2026-10-21T11:00:00Z"), 2, 2, "APERTURA prueba", contado);

    const saldoCaja = async () =>
      Number((await uno(`SELECT "CajaMonto" FROM caja WHERE "CajaId" = $1`, [caja.CajaId])).CajaMonto);
    const dif = async () =>
      Number((await uno(`SELECT "CierreDiferenciaMonto" FROM cierrediferencia WHERE "RegistroDiarioCajaId" = $1`,
        [c1.RegistroDiarioCajaId])).CierreDiferenciaMonto);
    const montoDe = async (id) =>
      Number((await uno(`SELECT "RegistroDiarioCajaMonto" FROM registrodiariocaja WHERE "RegistroDiarioCajaId" = $1`, [id])).RegistroDiarioCajaMonto);
    const existe2 = async (id) =>
      (await realQuery(`SELECT 1 FROM registrodiariocaja WHERE "RegistroDiarioCajaId" = $1`, [id])).rows.length === 1;

    ok((await dif()) === -20000, `diferencia inicial de ayer: ${await dif()} (esperado -20.000)`);
    const saldoHoy = await saldoCaja();

    console.log("Validación de fecha (no recargar con fecha de un turno cerrado)");
    let r = await llamar(rdc.create, {
      body: { CajaId: caja.CajaId, RegistroDiarioCajaFecha: AYER, TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 1 },
      user,
    });
    ok(r.status === 400 && /anterior a la apertura/.test(r.body.message), "alta con fecha de ayer rechazada");

    console.log("Registro Diario: listado, corrección y eliminación");
    const lista = await llamar(rdc.getAll, { query: { cajaId: String(caja.CajaId), limit: "200" }, user });
    const fila = (id) => lista.body.data.find((f) => f.RegistroDiarioCajaId === id);
    ok(fila(x.RegistroDiarioCajaId).MotivoNoCorregible === null, "movimiento común: corregible");
    ok(Boolean(fila(c1.RegistroDiarioCajaId).MotivoNoCorregible), "fila de cierre: no corregible");
    ok(/Cobranzas de Colegios/.test(fila(z.RegistroDiarioCajaId).MotivoNoCorregible || ""), "cobranza de colegio: no corregible desde acá");
    r = await llamar(rdc.corregir, { params: { id: x.RegistroDiarioCajaId }, body: { RegistroDiarioCajaMonto: 150000 }, user });
    ok(r.status === 400, "corregir sin motivo: 400");
    let d = await dif();
    r = await llamar(rdc.corregir, { params: { id: x.RegistroDiarioCajaId }, body: { RegistroDiarioCajaMonto: 150000, Motivo: "pagó 150.000" }, user });
    ok(r.status === 200 && (await dif()) === d + 50000, `corregido 100.000 -> 150.000: diferencia ${d} -> ${await dif()}`);
    d = await dif();
    r = await llamar(rdc.delete, { params: { id: y.RegistroDiarioCajaId }, body: { Motivo: "se cargó dos veces" }, user });
    ok(r.status === 200 && (await dif()) === d - 30000, `duplicado eliminado: diferencia ${d} -> ${await dif()}`);

    console.log("Cobranza de colegio: editar (+2 días de mora) y eliminar");
    d = await dif();
    r = await llamar(ccc.update, { params: { id: cob.ColegioCobranzaId }, body: { CajaId: caja.CajaId, NominaId: alumno.NominaId, ColegioCobranzaDiasMora: 2 }, user });
    ok(r.status === 200 && (await montoDe(z.RegistroDiarioCajaId)) === importe + 2000, "registro de la cobranza +2.000 (mismo ID)");
    ok((await dif()) === d + 2000, `diferencia ${d} -> ${await dif()}`);
    d = await dif();
    r = await llamar(ccc.delete, { params: { id: cob.ColegioCobranzaId }, body: { Motivo: "alumno equivocado" }, user });
    ok(r.status === 200 && (await dif()) === d - importe - 2000, `cobranza eliminada: diferencia ${d} -> ${await dif()}`);

    console.log("Cobro de JSI: editar monto y eliminar");
    r = await llamar(jsic.update, { params: { id: jsi.JSICobroId }, body: { CajaId: 999999 }, user });
    ok(r.status === 400, "cambiar la caja de un cobro ya registrado: 400");
    d = await dif();
    r = await llamar(jsic.update, { params: { id: jsi.JSICobroId }, body: { JSICobroMonto: 80000 }, user });
    ok(r.status === 200 && (await montoDe(j.RegistroDiarioCajaId)) === 80000, "registro del cobro 50.000 -> 80.000 (mismo ID): " + r.body.message);
    ok((await dif()) === d + 30000, `diferencia ${d} -> ${await dif()}`);
    d = await dif();
    r = await llamar(jsic.delete, { params: { id: jsi.JSICobroId }, body: { Motivo: "cobro anulado" }, user });
    ok(r.status === 200 && !(await existe2(j.RegistroDiarioCajaId)) && (await dif()) === d - 80000, `cobro eliminado: diferencia ${d} -> ${await dif()}`);

    console.log("Pago de transporte: editar monto y eliminar");
    r = await llamar(ptc.update, { params: { id: pago.PagoTransId }, body: { TransporteId: -1 }, user });
    ok(r.status === 400, "cambiar la empresa de un pago ya registrado: 400");
    d = await dif();
    r = await llamar(ptc.update, { params: { id: pago.PagoTransId }, body: { PagoTransMonto: 60000 }, user });
    ok(r.status === 200 && (await montoDe(t.RegistroDiarioCajaId)) === 60000, "registro del pago 70.000 -> 60.000 (mismo ID): " + r.body.message);
    ok((await dif()) === d - 10000, `diferencia ${d} -> ${await dif()}`);
    d = await dif();
    r = await llamar(ptc.delete, { params: { id: pago.PagoTransId }, body: {}, user });
    ok(r.status === 200 && (await dif()) === d - 60000, `pago eliminado: diferencia ${d} -> ${await dif()}`);

    ok((await saldoCaja()) === saldoHoy, "la caja del turno de hoy no cambió en ningún paso");

    console.log("Atomicidad: una eliminación que falla en el último paso no deja nada a medias");
    const z2 = await ins(AYER, 2, grupo.TipoGastoGrupoId, "otro", 5000);
    r = await llamar(rdc.delete, { params: { id: z2.RegistroDiarioCajaId }, body: {}, user: undefined });
    ok(r.status === 500 && (await existe2(z2.RegistroDiarioCajaId)) && (await saldoCaja()) === saldoHoy, "rollback completo");

    console.log("Diferencias de Cierre: auditoría");
    const det = await llamar(cdc.getDetalle, { params: { id: c1.RegistroDiarioCajaId }, user });
    const tipos = det.body.correcciones.map((c) => c.Tipo);
    ok(tipos.length === 8, `8 correcciones auditadas (${tipos.join(", ")})`);
    ok(det.body.correcciones.some((c) => c.Motivo === "se cargó dos veces"), "el motivo de la eliminación quedó auditado");
    ok(det.body.correcciones.every((c) => c.DiferenciaAnterior !== null && c.DiferenciaNueva !== null), "cada una guarda la diferencia antes/después");
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
})();
