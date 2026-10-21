// Prueba de simetría de cajas: para cada pantalla de cobro, eliminar (o
// corregir/reclasificar) un movimiento tiene que dejar TODAS las cajas como si
// la creación nunca hubiera pasado (o como si se hubiera creado con el valor
// corregido). La creación se reproduce con la lógica de cada tab
// (scripts/lib/creacionTabs.js) y la reversión se hace con los endpoints
// reales, con el turno abierto (así también se revierte la caja del cajero).
//
// NO MODIFICA LA BASE: corre dentro de una transacción que se revierte (ver
// scripts/lib/transaccionDePrueba.js). Conviene correrla contra la base local
// o una copia, no contra producción.
//
// Uso (desde api/):  node scripts/prueba-simetria-cajas.js
// Sale con código 1 si alguna verificación falla.
const { conTransaccionDePrueba } = require("./lib/transaccionDePrueba");
const { crearTabs } = require("./lib/creacionTabs");

conTransaccionDePrueba(async ({ realQuery, uno, llamar, ok, user, usuario }) => {
  const rdc = require("../controllers/registrodiariocaja.controller");
  const ccc = require("../controllers/colegiocobranza.controller");
  const jsic = require("../controllers/jsicobro.controller");
  const ptc = require("../controllers/pagotrans.controller");
  const wec = require("../controllers/westernenvio.controller");
  const tabs = crearTabs({ realQuery, uno, usuario });

  const caja = await uno(`SELECT * FROM caja WHERE "CajaTipoId" = 1 ORDER BY "CajaId" LIMIT 1`);
  const HOY = "2026-10-21T12:00";
  // Turno abierto en la caja de prueba
  await realQuery(
    `INSERT INTO registrodiariocaja ("CajaId","RegistroDiarioCajaFecha","TipoGastoId","TipoGastoGrupoId",
       "RegistroDiarioCajaCambio","RegistroDiarioCajaDetalle","RegistroDiarioCajaMTCN","RegistroDiarioCajaCargoEnvio",
       "RegistroDiarioCajaMonto","RegistroDiarioCajaPendiente1","RegistroDiarioCajaPendiente2",
       "RegistroDiarioCajaPendiente3","RegistroDiarioCajaPendiente4","UsuarioId")
     VALUES ($1, now(), 2, 2, 0, 'APERTURA prueba', 0, 0, 0, 0, 0, 0, 0, $2)`,
    [caja.CajaId, usuario]
  );

  const grupo = async (tipo, descripcion) =>
    Number((await uno(
      `SELECT "TipoGastoGrupoId" FROM tipogastogrupo WHERE "TipoGastoId" = $1 AND TRIM("TipoGastoGrupoDescripcion") = $2`,
      [tipo, descripcion]
    ))?.TipoGastoGrupoId) || null;
  const saldos = async () =>
    new Map((await realQuery(`SELECT "CajaId", "CajaMonto"::float AS m FROM caja`)).rows.map((x) => [x.CajaId, x.m]));
  const diferencias = (a, b) =>
    [...a]
      .filter(([id, m]) => Math.abs(m - b.get(id)) >= 0.01)
      .map(([id, m]) => `caja ${id}: ${b.get(id) - m}`);
  // Efecto en las cajas de una creación, medido dentro de un savepoint y deshecho
  const efecto = async (crear) => {
    await realQuery("SAVEPOINT efecto");
    const antes = await saldos();
    await crear();
    const despues = await saldos();
    await realQuery("ROLLBACK TO SAVEPOINT efecto");
    return new Map([...despues].map(([id, m]) => [id, m - antes.get(id)]));
  };
  const sumarEfecto = (base, delta) => new Map([...base].map(([id, m]) => [id, m + (delta.get(id) || 0)]));

  // Crear con la lógica del tab, revertir con el endpoint y comparar cajas
  const simetria = async (titulo, crear, revertir) => {
    const antes = await saldos();
    const creado = await crear();
    const r = await revertir(creado);
    const diff = diferencias(antes, await saldos());
    ok(r.status === 200 && diff.length === 0,
      `${titulo}${r.status !== 200 ? ` [${r.status} ${r.body?.message}]` : ""}${diff.length ? ` — no vuelven: ${diff.join(", ")}` : ""}`);
  };
  const eliminarRegistro = (registro) =>
    llamar(rdc.delete, { params: { id: registro.RegistroDiarioCajaId }, body: { Motivo: "prueba" }, user });

  console.log("Eliminar revierte todas las cajas (turno abierto)");
  const casosCobranza = [
    ["Cobranza 2/JUAN CRISOSTOMO CENTURION (grupo 13: en Western es otra cosa)", 2, await grupo(2, "JUAN CRISOSTOMO CENTURION")],
    ["Cobranza 2/POSITIVA (grupo 5)", 2, await grupo(2, "POSITIVA")],
    ["Cobranza 2/R12 (caja de divisa en el gasto)", 2, await grupo(2, "R12")],
    ["Pago 1/EXTRACCIONES", 1, await grupo(1, "EXTRACCIONES")],
    ["Pago 1/J.S.I. DEPOSITOS1", 1, await grupo(1, "J.S.I. DEPOSITOS1")],
  ];
  for (const [titulo, tipo, g] of casosCobranza) {
    if (!g) { console.log(`  (sin el grupo de "${titulo}" en esta base)`); continue; }
    await simetria(titulo, () => tabs.cobranza({ cajaId: caja.CajaId, fecha: HOY, tipo, grupo: g, monto: 123000 }), eliminarRegistro);
  }

  const grupoJSI = await grupo(2, "J.S.I.");
  await simetria("Cobro JSI",
    () => tabs.jsi({ cajaId: caja.CajaId, fecha: HOY, grupo: grupoJSI, monto: 85000 }),
    ({ cobro }) => llamar(jsic.delete, { params: { id: cobro.JSICobroId }, body: { Motivo: "prueba" }, user }));

  const transporte = await uno(`SELECT * FROM transporte WHERE "TipoGastoId" = 2 AND "TipoGastoGrupoId" IS NOT NULL LIMIT 1`);
  await simetria("Pago de transporte",
    () => tabs.transporte({ cajaId: caja.CajaId, fecha: HOY, transporte, monto: 95000 }),
    ({ pago }) => llamar(ptc.delete, { params: { id: pago.PagoTransId }, body: { Motivo: "prueba" }, user }));

  const alumno = await uno(
    `SELECT n."NominaId", col."TipoGastoGrupoId", cur."ColegioCursoImporte"
     FROM nomina n JOIN colegio col ON col."ColegioId" = n."ColegioId"
     JOIN colegiocurso cur ON cur."ColegioId" = n."ColegioId" AND cur."ColegioCursoId" = n."ColegioCursoId"
     WHERE col."TipoGastoId" = 2 AND col."TipoGastoGrupoId" IS NOT NULL LIMIT 1`
  );
  await simetria("Cobranza de colegio",
    () => tabs.colegio({ cajaId: caja.CajaId, fecha: HOY, alumno }),
    ({ cobranza }) => llamar(ccc.delete, { params: { id: cobranza.ColegioCobranzaId }, body: { Motivo: "prueba" }, user }));

  const casosWestern = [
    ["Western pago Gs.", 1, "1 WESTERN - GS.", 700000, 0],
    ["Western pago USD con cotización", 1, "2 WESTERN - UDS CON COTIZACION", 730000, 7300],
    ["Western pago USD", 1, "3 WESTERN - USD.", 100, 0],
    ["Western envío Gs.", 2, "1 WESTERN - ENVIOS GS.", 500000, 0],
    ["Western envío USD con cotización", 2, "2 WESTERN - USD CON COTIZACION", 365000, 7300],
    ["Western envío USD", 2, "3 WESTERN - USD.", 50, 0],
  ];
  for (const [titulo, tipo, descripcion, monto, cambioDolar] of casosWestern) {
    const g = await grupo(tipo, descripcion);
    if (!g) { console.log(`  (sin el grupo "${descripcion}" en esta base)`); continue; }
    await simetria(titulo,
      () => tabs.western({ cajaId: caja.CajaId, fecha: HOY, tipo, grupo: g, monto, cambioDolar }),
      ({ envio }) => llamar(wec.delete, { params: { id: envio.WesternEnvioId }, body: { Motivo: "prueba" }, user }));
  }

  const dolar = await uno(`SELECT "DivisaId" FROM divisa WHERE TRIM("DivisaNombre") = 'DOLAR'`);
  if (dolar) {
    for (const [titulo, tipoMovimiento] of [["Divisas: compra de dólares", "C"], ["Divisas: venta de dólares", "V"]]) {
      await simetria(titulo,
        () => tabs.divisa({ cajaId: caja.CajaId, fecha: HOY, divisaId: dolar.DivisaId, tipoMovimiento, cantidad: 150, cambio: 7250 }),
        ({ registro }) => eliminarRegistro(registro));
    }
  }

  console.log("Corregir / reclasificar deja las cajas como si se hubiera creado bien (turno abierto)");
  const gJuan = await grupo(2, "JUAN CRISOSTOMO CENTURION");
  if (gJuan) {
    const antes = await saldos();
    const esperado = sumarEfecto(antes, await efecto(() =>
      tabs.cobranza({ cajaId: caja.CajaId, fecha: HOY, tipo: 2, grupo: gJuan, monto: 150000 })));
    const reg = await tabs.cobranza({ cajaId: caja.CajaId, fecha: HOY, tipo: 2, grupo: gJuan, monto: 100000 });
    const r = await llamar(rdc.corregir, { params: { id: reg.RegistroDiarioCajaId }, body: { RegistroDiarioCajaMonto: 150000, Motivo: "prueba" }, user });
    const diff = diferencias(esperado, await saldos());
    ok(r.status === 200 && diff.length === 0, `Corregir cobranza 100.000 -> 150.000${diff.length ? " — " + diff.join(", ") : ""}`);
  }
  {
    const antes = await saldos();
    const esperado = sumarEfecto(antes, await efecto(() =>
      tabs.jsi({ cajaId: caja.CajaId, fecha: HOY, grupo: grupoJSI, monto: 80000 })));
    const { cobro } = await tabs.jsi({ cajaId: caja.CajaId, fecha: HOY, grupo: grupoJSI, monto: 50000 });
    const r = await llamar(jsic.update, { params: { id: cobro.JSICobroId }, body: { JSICobroMonto: 80000 }, user });
    const diff = diferencias(esperado, await saldos());
    ok(r.status === 200 && diff.length === 0, `Corregir cobro JSI 50.000 -> 80.000${diff.length ? " — " + diff.join(", ") : ""}`);
  }
  for (const [titulo, tipo, de, a, monto, cambioDolar] of [
    ["Reclasificar pago Western USD -> Gs.", 1, "3 WESTERN - USD.", "1 WESTERN - GS.", 700000, 0],
    ["Reclasificar pago Western Gs. -> USD con cotización", 1, "1 WESTERN - GS.", "2 WESTERN - UDS CON COTIZACION", 730000, 7300],
    ["Reclasificar envío Western USD -> Gs.", 2, "3 WESTERN - USD.", "1 WESTERN - ENVIOS GS.", 500000, 0],
  ]) {
    const gDe = await grupo(tipo, de);
    const gA = await grupo(tipo, a);
    if (!gDe || !gA) continue;
    const antes = await saldos();
    const esperado = sumarEfecto(antes, await efecto(() =>
      tabs.western({ cajaId: caja.CajaId, fecha: HOY, tipo, grupo: gA, monto, cambioDolar })));
    const { envio } = await tabs.western({ cajaId: caja.CajaId, fecha: HOY, tipo, grupo: gDe, monto, cambioDolar });
    const r = await llamar(wec.update, {
      params: { id: envio.WesternEnvioId },
      body: { TipoGastoGrupoId: gA, WesternEnvioCambio: cambioDolar, Motivo: "prueba" },
      user,
    });
    const diff = diferencias(esperado, await saldos());
    ok(r.status === 200 && diff.length === 0, `${titulo}${r.status !== 200 ? ` [${r.status} ${r.body?.message}]` : ""}${diff.length ? " — " + diff.join(", ") : ""}`);
  }
});
