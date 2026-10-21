// Prueba de punta a punta de la corrección de movimientos de turnos cerrados:
// Registro Diario, cobranzas de colegio, cobros de JSI, pagos de transporte y
// Western (reclasificar un pago Gs. cargado como USD), llamando a los
// controllers reales.
//
// NO MODIFICA LA BASE: corre dentro de una transacción que se revierte (ver
// scripts/lib/transaccionDePrueba.js). Conviene correrla contra la base local
// o una copia, no contra producción.
//
// Uso (desde api/):  node scripts/prueba-correcciones-turno.js
// Sale con código 1 si alguna verificación falla.
const { conTransaccionDePrueba } = require("./lib/transaccionDePrueba");
const { crearTabs } = require("./lib/creacionTabs");

conTransaccionDePrueba(async ({ realQuery, uno, transaccion, llamar, ok, user, usuario }) => {
  const rdc = require("../controllers/registrodiariocaja.controller");
  const cdc = require("../controllers/cierrediferencia.controller");
  const ccc = require("../controllers/colegiocobranza.controller");
  const jsic = require("../controllers/jsicobro.controller");
  const ptc = require("../controllers/pagotrans.controller");
  const wec = require("../controllers/westernenvio.controller");
  const tabs = crearTabs({ realQuery, uno, usuario });
  const CierreDiferencia = require("../models/cierrediferencia.model");

  const caja = await uno(`SELECT * FROM caja WHERE "CajaTipoId" = 1 ORDER BY "CajaId" LIMIT 1`);
  const cliente = await uno(`SELECT "ClienteId" FROM clientes ORDER BY "ClienteId" LIMIT 1`);
  const otroCliente = await uno(`SELECT "ClienteId" FROM clientes ORDER BY "ClienteId" OFFSET 1 LIMIT 1`);
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
  const grupoWestern = async (descripcion) =>
    Number((await uno(
      `SELECT "TipoGastoGrupoId" FROM tipogastogrupo WHERE "TipoGastoId" = 1 AND TRIM("TipoGastoGrupoDescripcion") = $1`,
      [descripcion]
    ))?.TipoGastoGrupoId);
  const westernUSD = await grupoWestern("3 WESTERN - USD.");
  const westernGs = await grupoWestern("1 WESTERN - GS.");
  if (!caja || !cliente || !otroCliente || !grupo || !alumno || !transporte || !grupoJSI || !westernUSD || !westernGs) {
    throw new Error("Faltan datos de base (caja interna, cliente, colegio, transporte o grupo JSI)");
  }

  const INS = `INSERT INTO registrodiariocaja ("CajaId","RegistroDiarioCajaFecha","TipoGastoId","TipoGastoGrupoId",
    "RegistroDiarioCajaCambio","RegistroDiarioCajaDetalle","RegistroDiarioCajaMTCN","RegistroDiarioCajaCargoEnvio",
    "RegistroDiarioCajaMonto","RegistroDiarioCajaPendiente1","RegistroDiarioCajaPendiente2","RegistroDiarioCajaPendiente3",
    "RegistroDiarioCajaPendiente4","UsuarioId") VALUES ($1,$2,$3,$4,0,$5,0,0,$6,0,0,0,0,$7) RETURNING *`;
  const ins = async (fecha, tipo, grupoId, det, monto) =>
    (await realQuery(INS, [caja.CajaId, fecha, tipo, grupoId, det, monto, usuario])).rows[0];

  // ── Turno de "ayer" (cerrado) con un movimiento de cada origen ──
  // Días de "ayer" y "hoy" en Paraguay, relativos a hoy (el cajero sólo puede
  // cargar en cierres de los últimos días)
  const diaPY = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
  const diaHoy = diaPY(new Date());
  const diaAyer = diaPY(new Date(Date.now() - 24 * 3600 * 1000));
  const AYER = `${diaAyer}T10:00`;
  const importe = Number(alumno.ColegioCursoImporte);
  await ins(new Date(`${diaAyer}T11:00:00Z`), 2, 2, "APERTURA prueba", 1000000);
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
  // Pago Western de 700.000 Gs. cargado por error con el grupo USD: el
  // efectivo salió igual, así que el arqueo de ese turno lo cuenta
  const w = await tabs.western({ cajaId: caja.CajaId, fecha: AYER, tipo: 1, grupo: westernUSD, monto: 700000 });
  const contado = 1000000 + 150000 + importe + 50000 + 70000 - 700000;
  const c1 = await ins(new Date(`${diaAyer}T22:00:00Z`), 1, 2, "CIERRE prueba", contado);
  await CierreDiferencia.registrarParaCierre(transaccion, c1.RegistroDiarioCajaId);
  await realQuery(`UPDATE caja SET "CajaMonto" = $2 WHERE "CajaId" = $1`, [caja.CajaId, contado]);
  // ── Turno de "hoy" (abierto) ──
  const aperturaHoy = await ins(new Date(`${diaHoy}T11:00:00Z`), 2, 2, "APERTURA prueba", contado);

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
  ok(r.status === 400 && /anterior a la apertura/.test(r.body.message) && /Diferencias de Cierre/.test(r.body.message),
    "alta con fecha de ayer rechazada (indica agregarlo desde Diferencias de Cierre)");

  console.log("Registro Diario: listado, corrección y eliminación");
  const lista = await llamar(rdc.getAll, { query: { cajaId: String(caja.CajaId), limit: "200" }, user });
  const fila = (id) => lista.body.data.find((f) => f.RegistroDiarioCajaId === id);
  ok(fila(x.RegistroDiarioCajaId).MotivoNoCorregible === null, "movimiento común: corregible");
  ok(Boolean(fila(c1.RegistroDiarioCajaId).MotivoNoCorregible), "fila de cierre: no corregible");
  ok(/Cobranzas de Colegios/.test(fila(z.RegistroDiarioCajaId).MotivoNoCorregible || ""), "cobranza de colegio: no corregible desde acá");
  ok(fila(x.RegistroDiarioCajaId).MotivoNoEliminable === null, "movimiento común: eliminable");
  ok(/Cobros JSI/.test(fila(j.RegistroDiarioCajaId).MotivoNoEliminable || ""), "cobro de JSI: se elimina desde Cobros JSI");
  r = await llamar(rdc.delete, { params: { id: j.RegistroDiarioCajaId }, body: { Motivo: "x" }, user });
  ok(r.status === 400 && (await existe2(j.RegistroDiarioCajaId)), "eliminar el registro de un cobro JSI desde Registro Diario: 400, sigue existiendo");
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
  r = await llamar(jsic.update, { params: { id: jsi.JSICobroId }, body: { ClienteId: otroCliente.ClienteId }, user });
  const detalleJ = (await uno(`SELECT "RegistroDiarioCajaDetalle" d FROM registrodiariocaja WHERE "RegistroDiarioCajaId" = $1`, [j.RegistroDiarioCajaId])).d;
  ok(r.status === 200 && detalleJ.startsWith(`ClienteId:${otroCliente.ClienteId} |`) && detalleJ.endsWith(`JSICobroId:${jsi.JSICobroId}`),
    "cambio de cliente: detalle rehecho -> " + detalleJ);
  ok((await montoDe(j.RegistroDiarioCajaId)) === 80000 && (await dif()) === d, "cambio de cliente: monto y diferencia sin cambios");
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

  console.log("Western: pago Gs. cargado como USD (el caso del cliente)");
  const saldos = async () =>
    new Map((await realQuery(`SELECT "CajaId", "CajaMonto"::float AS m FROM caja`)).rows.map((x) => [x.CajaId, x.m]));
  // Efecto en las cajas de crear un pago Western con ese grupo (réplica del
  // tab, medida dentro de un savepoint y deshecha)
  const efectoWestern = async (grupoId, monto) => {
    await realQuery("SAVEPOINT efecto");
    const antes = await saldos();
    await tabs.western({ cajaId: caja.CajaId, fecha: AYER, tipo: 1, grupo: grupoId, monto });
    const despues = await saldos();
    await realQuery("ROLLBACK TO SAVEPOINT efecto");
    return new Map([...despues].map(([id, m]) => [id, m - antes.get(id)]));
  };
  const cajasIguales = (a, b) => [...a].every(([id, m]) => Math.abs(m - b.get(id)) < 0.01);
  const lista2 = await llamar(rdc.getAll, { query: { cajaId: String(caja.CajaId), limit: "200" }, user });
  const filaW = lista2.body.data.find((f) => f.RegistroDiarioCajaId === w.registro.RegistroDiarioCajaId);
  ok(/Western/.test(filaW.MotivoNoEliminable || "") && Boolean(filaW.MotivoNoCorregible), "Registro Diario: Western no se corrige ni elimina desde acá");
  r = await llamar(rdc.delete, { params: { id: w.registro.RegistroDiarioCajaId }, body: { Motivo: "x" }, user });
  ok(r.status === 400 && (await existe2(w.registro.RegistroDiarioCajaId)), "eliminarlo desde Registro Diario: 400, sigue existiendo");
  r = await llamar(wec.update, { params: { id: w.envio.WesternEnvioId }, body: { TipoGastoGrupoId: westernGs }, user });
  ok(r.status === 400 && /motivo/i.test(r.body.message), "reclasificar sin motivo: 400");
  r = await llamar(wec.update, { params: { id: w.envio.WesternEnvioId }, body: { CajaId: 999999, TipoGastoGrupoId: westernGs, Motivo: "x" }, user });
  ok(r.status === 400, "cambiar la caja: 400");

  const s0 = await saldos();
  const esperado = new Map(s0);
  for (const [id, m] of await efectoWestern(westernUSD, 700000)) esperado.set(id, esperado.get(id) - m);
  for (const [id, m] of await efectoWestern(westernGs, 700000)) esperado.set(id, esperado.get(id) + m);
  esperado.set(caja.CajaId, s0.get(caja.CajaId)); // turno cerrado: la caja del cajero no se toca
  d = await dif();
  r = await llamar(wec.update, { params: { id: w.envio.WesternEnvioId }, body: { TipoGastoGrupoId: westernGs, Motivo: "era Western Gs." }, user });
  const regW = await uno(`SELECT * FROM registrodiariocaja WHERE "RegistroDiarioCajaId" = $1`, [w.registro.RegistroDiarioCajaId]);
  const envW = await uno(`SELECT * FROM westernenvio WHERE "WesternEnvioId" = $1`, [w.envio.WesternEnvioId]);
  ok(r.status === 200 && regW.TipoGastoGrupoId === westernGs && envW.TipoGastoGrupoId === westernGs,
    "reclasificado USD -> Gs. (mismo ID, registro y envío): " + r.body.message);
  ok(cajasIguales(esperado, await saldos()), "cada caja quedó como si se hubiera cargado en Gs. (cuenta USD revertida, cuenta Gs. aplicada)");
  ok((await dif()) === d, `diferencia de ayer sin cambios (el efectivo era el mismo): ${await dif()}`);
  r = await llamar(wec.update, { params: { id: w.envio.WesternEnvioId }, body: { WesternEnvioMonto: 650000, Motivo: "era 650.000" }, user });
  ok(r.status === 200 && (await montoDe(w.registro.RegistroDiarioCajaId)) === 650000 && (await dif()) === d + 50000,
    `monto 700.000 -> 650.000: diferencia ${d} -> ${await dif()}`);
  d = await dif();
  r = await llamar(wec.delete, { params: { id: w.envio.WesternEnvioId }, body: { Motivo: "pago anulado" }, user });
  const quedaEnvio = (await realQuery(`SELECT 1 FROM westernenvio WHERE "WesternEnvioId" = $1`, [w.envio.WesternEnvioId])).rows.length;
  ok(r.status === 200 && !(await existe2(w.registro.RegistroDiarioCajaId)) && !quedaEnvio && (await dif()) === d + 650000,
    `eliminado desde Western (registro y envío): diferencia ${d} -> ${await dif()}`);

  console.log("Agregar a un cierre anterior un movimiento que faltó (el segundo caso del cliente)");
  const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
  const teoricoHoy = async () => (await RegistroDiarioCaja.getSaldoTeorico(aperturaHoy.RegistroDiarioCajaId, caja.CajaId)).saldoTeorico;
  const teoricoAntes = await teoricoHoy();
  const agregar = (body) => llamar(cdc.agregarMovimiento, { params: { id: c1.RegistroDiarioCajaId }, body, user });
  r = await agregar({ TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 40000 });
  ok(r.status === 400 && /motivo/i.test(r.body.message), "sin motivo: 400");
  r = await agregar({ TipoGastoId: 1, TipoGastoGrupoId: westernGs, RegistroDiarioCajaMonto: 40000, Motivo: "x" });
  ok(r.status === 400, "grupo Western: 400");
  const s1 = await saldos();
  const esperadoAlta = new Map(s1);
  for (const [cajaId, m] of await (async () => {
    await realQuery("SAVEPOINT efecto");
    const antes = await saldos();
    await tabs.cobranza({ cajaId: caja.CajaId, fecha: AYER, tipo: 2, grupo: grupo.TipoGastoGrupoId, monto: 40000 });
    const despues = await saldos();
    await realQuery("ROLLBACK TO SAVEPOINT efecto");
    return new Map([...despues].map(([id, v]) => [id, v - antes.get(id)]));
  })()) esperadoAlta.set(cajaId, esperadoAlta.get(cajaId) + m);
  esperadoAlta.set(caja.CajaId, s1.get(caja.CajaId)); // la caja del cajero no se toca
  d = await dif();
  r = await agregar({ TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 40000,
    RegistroDiarioCajaDetalle: "cobranza que se eliminó", Motivo: "se eliminó antes de los cambios y faltaba" });
  const agregado = r.body?.data?.registro;
  ok(r.status === 201 && agregado?.RegistroDiarioCajaCierreId === c1.RegistroDiarioCajaId && (await dif()) === d + 40000,
    `agregado al cierre de ayer: diferencia ${d} -> ${await dif()}`);
  ok(agregado.RegistroDiarioCajaId > aperturaHoy.RegistroDiarioCajaId && (await teoricoHoy()) === teoricoAntes,
    "aunque su ID cae en el turno de hoy, el saldo teórico de hoy no cambió");
  ok(cajasIguales(esperadoAlta, await saldos()), "demás cajas del gasto ajustadas; la caja del cajero, no");
  const ticket = await RegistroDiarioCaja.getTurnoCierre(usuario, caja.CajaId);
  ok(ticket.cierreId === c1.RegistroDiarioCajaId && ticket.registros.some((x) => x.RegistroDiarioCajaId === agregado.RegistroDiarioCajaId),
    "el ticket de ese cierre lo incluye");
  const detAlta = await llamar(cdc.getDetalle, { params: { id: c1.RegistroDiarioCajaId }, user });
  ok(detAlta.body.movimientos.some((m) => m.Id === agregado.RegistroDiarioCajaId && m.AgregadoDespues),
    "aparece en el detalle del cierre marcado como agregado después");
  d = await dif();
  r = await llamar(rdc.corregir, { params: { id: agregado.RegistroDiarioCajaId }, body: { RegistroDiarioCajaMonto: 45000, Motivo: "eran 45.000" }, user });
  ok(r.status === 200 && r.body.data.cierreId === c1.RegistroDiarioCajaId && (await dif()) === d + 5000 && (await teoricoHoy()) === teoricoAntes,
    `corregirlo después sigue tocando ese cierre: diferencia ${d} -> ${await dif()}`);
  d = await dif();
  r = await llamar(rdc.delete, { params: { id: agregado.RegistroDiarioCajaId }, body: { Motivo: "prueba" }, user });
  ok(r.status === 200 && (await dif()) === d - 45000 && cajasIguales(s1, await saldos()),
    `eliminarlo deja todo como antes: diferencia ${d} -> ${await dif()}`);

  console.log("Agregar a un cierre anterior un cobro de JSI que faltó");
  r = await agregar({ TipoGastoId: 2, TipoGastoGrupoId: grupoJSI.TipoGastoGrupoId, RegistroDiarioCajaMonto: 60000, Motivo: "x" });
  ok(r.status === 400 && /Cobro de JSI/.test(r.body.message), "como movimiento suelto con el grupo J.S.I.: 400 (indica la opción Cobro de JSI)");
  r = await agregar({ Origen: "JSI", RegistroDiarioCajaMonto: 60000, Motivo: "x" });
  ok(r.status === 400 && /cliente/i.test(r.body.message), "sin cliente: 400");
  const s2 = await saldos();
  const esperadoJSI = new Map(s2);
  await realQuery("SAVEPOINT efecto");
  const antesJSI = await saldos();
  await tabs.jsi({ cajaId: caja.CajaId, fecha: AYER, grupo: grupoJSI.TipoGastoGrupoId, monto: 60000 });
  const despuesJSI = await saldos();
  await realQuery("ROLLBACK TO SAVEPOINT efecto");
  for (const [cajaId, v] of despuesJSI) esperadoJSI.set(cajaId, esperadoJSI.get(cajaId) + v - antesJSI.get(cajaId));
  esperadoJSI.set(caja.CajaId, s2.get(caja.CajaId)); // la caja del cajero no se toca
  d = await dif();
  r = await agregar({ Origen: "JSI", ClienteId: cliente.ClienteId, RegistroDiarioCajaMonto: 60000, Motivo: "faltó cargar el cobro" });
  const regJSI = r.body?.data?.registro;
  const idCobro = Number(/JSICobroId:(\d+)/.exec(regJSI?.RegistroDiarioCajaDetalle || "")?.[1]);
  const cobroJSI = idCobro ? await uno(`SELECT * FROM jsicobro WHERE "JSICobroId" = $1`, [idCobro]) : null;
  ok(r.status === 201 && regJSI.RegistroDiarioCajaCierreId === c1.RegistroDiarioCajaId && (await dif()) === d + 60000,
    `agregado al cierre de ayer: diferencia ${d} -> ${await dif()}`);
  ok(cobroJSI && Number(cobroJSI.ClienteId) === Number(cliente.ClienteId) && Number(cobroJSI.JSICobroMonto) === 60000 &&
    cobroJSI.JSICobroFecha.getTime() === c1.RegistroDiarioCajaFecha.getTime(),
    "se creó el cobro de JSI (cliente, monto y fecha del cierre)");
  ok(regJSI.RegistroDiarioCajaDetalle.startsWith(`ClienteId:${cliente.ClienteId} |`) && regJSI.RegistroDiarioCajaDetalle.endsWith(`JSICobroId:${idCobro}`),
    "detalle del registro con el formato de la pestaña JSI: " + regJSI.RegistroDiarioCajaDetalle);
  ok(cajasIguales(esperadoJSI, await saldos()) && (await teoricoHoy()) === teoricoAntes,
    "caja J.S.I. ajustada como al cobrar desde la pestaña; caja del cajero y turno de hoy sin cambios");
  d = await dif();
  r = await llamar(jsic.delete, { params: { id: idCobro }, body: { Motivo: "prueba" }, user });
  const quedaCobro = (await realQuery(`SELECT 1 FROM jsicobro WHERE "JSICobroId" = $1`, [idCobro])).rows.length;
  ok(r.status === 200 && !quedaCobro && !(await existe2(regJSI.RegistroDiarioCajaId)) && (await dif()) === d - 60000 && cajasIguales(s2, await saldos()),
    `eliminarlo desde Cobros JSI deja todo como antes: diferencia ${d} -> ${await dif()}`);

  console.log("El cajero carga desde Cobranza / JSI con la fecha de ayer (pedido del cliente)");
  r = await llamar(rdc.create, {
    body: { CajaId: caja.CajaId, RegistroDiarioCajaFecha: AYER, TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000 },
    user,
  });
  ok(r.status === 400 && r.body.codigo === "TURNO_CERRADO", "Cobranza con fecha de ayer: el alta normal avisa TURNO_CERRADO");
  r = await llamar(jsic.create, { body: { CajaId: caja.CajaId, JSICobroFecha: AYER, ClienteId: cliente.ClienteId, JSICobroMonto: 33000 }, user });
  ok(r.status === 400 && r.body.codigo === "TURNO_CERRADO", "JSI con fecha de ayer: el alta normal avisa TURNO_CERRADO");
  const cargar = (body) => llamar(rdc.cargarEnCierreAnterior, { body: { CajaId: caja.CajaId, Fecha: AYER, ...body }, user });
  r = await cargar({ TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000 });
  ok(r.status === 400 && /motivo/i.test(r.body.message), "sin motivo: 400");
  r = await cargar({ Fecha: `${diaHoy}T12:00`, TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000, Motivo: "x" });
  ok(r.status === 400 && /turno en curso/.test(r.body.message), "con fecha de hoy: 400 (va por el alta normal)");
  const haceDiezDias = new Date(Date.now() - 10 * 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" });
  r = await cargar({ Fecha: `${haceDiezDias}T10:00`, TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000, Motivo: "x" });
  ok(r.status === 400 && /supervisor/.test(r.body.message), "hace 10 días: 400 (lo agrega un supervisor)");
  const otraCaja = await uno(`SELECT "CajaId" FROM caja WHERE "CajaTipoId" = 1 AND "CajaId" <> $1 LIMIT 1`, [caja.CajaId]);
  r = await llamar(rdc.cargarEnCierreAnterior, { body: { CajaId: otraCaja.CajaId, Fecha: AYER, TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000, Motivo: "x" }, user });
  ok(r.status === 400 && /abierta esa caja/.test(r.body.message), "en una caja que el usuario no tiene abierta: 400");

  const s3 = await saldos();
  d = await dif();
  r = await cargar({ TipoGastoId: 2, TipoGastoGrupoId: grupo.TipoGastoGrupoId, RegistroDiarioCajaMonto: 25000,
    RegistroDiarioCajaDetalle: "cobranza de ayer", RegistroDiarioCajaMTCN: 123, Motivo: "se olvidó cargar ayer" });
  const cobranzaAyer = r.body?.data?.registro;
  ok(r.status === 201 && cobranzaAyer.RegistroDiarioCajaCierreId === c1.RegistroDiarioCajaId && Number(cobranzaAyer.RegistroDiarioCajaMTCN) === 123 &&
    (await dif()) === d + 25000, `Cobranza cargada en el cierre de ayer: diferencia ${d} -> ${await dif()} — ${r.body.message}`);
  ok((await saldos()).get(caja.CajaId) === s3.get(caja.CajaId) && (await teoricoHoy()) === teoricoAntes,
    "la caja del cajero y el turno de hoy no cambian");
  d = await dif();
  r = await cargar({ Origen: "JSI", ClienteId: cliente.ClienteId, CodigoJSI: "999", RegistroDiarioCajaMonto: 33000, Motivo: "faltó el cobro de ayer" });
  const jsiAyer = r.body?.data?.registro;
  const idCobroAyer = Number(/JSICobroId:(\d+)/.exec(jsiAyer?.RegistroDiarioCajaDetalle || "")?.[1]);
  ok(r.status === 201 && jsiAyer.RegistroDiarioCajaCierreId === c1.RegistroDiarioCajaId && idCobroAyer > 0 && (await dif()) === d + 33000,
    `Cobro de JSI cargado en el cierre de ayer (crea el cobro): diferencia ${d} -> ${await dif()}`);
  const auditoriaCajero = await uno(
    `SELECT COUNT(*)::int AS n FROM registrocorreccion WHERE "RegistroCorreccionMotivo" LIKE 'Cargado por el cajero:%'`);
  ok(auditoriaCajero.n === 2, "queda auditado como cargado por el cajero");

  ok((await saldoCaja()) === saldoHoy, "la caja del turno de hoy no cambió en ningún paso");

  console.log("Atomicidad: una eliminación que falla en el último paso no deja nada a medias");
  const z2 = await ins(AYER, 2, grupo.TipoGastoGrupoId, "otro", 5000);
  r = await llamar(rdc.delete, { params: { id: z2.RegistroDiarioCajaId }, body: {}, user: undefined });
  ok(r.status === 500 && (await existe2(z2.RegistroDiarioCajaId)) && (await saldoCaja()) === saldoHoy, "rollback completo");

  console.log("Diferencias de Cierre: auditoría");
  const det = await llamar(cdc.getDetalle, { params: { id: c1.RegistroDiarioCajaId }, user });
  const tipos = det.body.correcciones.map((c) => c.Tipo);
  ok(tipos.length === 19, `19 correcciones auditadas (${tipos.join(", ")})`);
  ok(det.body.correcciones.some((c) => c.Motivo === "se cargó dos veces"), "el motivo de la eliminación quedó auditado");
  ok(det.body.correcciones.every((c) => c.DiferenciaAnterior !== null && c.DiferenciaNueva !== null), "cada una guarda la diferencia antes/después");
});
