const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");
const JSICobro = require("../models/jsicobro.model");
const WesternEnvio = require("../models/westernenvio.model");
const ColegioCobranza = require("../models/colegiocobranza.model");
const PagoTrans = require("../models/pagotrans.model");
const { esGrupoWestern, revertirAperturadaYDemas, revertirWestern } = require("./ajusteCajas");
const { esGrupoUsd } = require("./gruposUsd");

const errorConStatus = (status, message) => Object.assign(new Error(message), { status });

// Grupos "USD CON COTIZACION" de Western (pagos 8, envíos 15): sólo en ellos
// se guarda el cambio (igual que WesternPagosTab)
const esWesternConCotizacion = (tipo, grupoId) =>
  (tipo === 1 && grupoId === 8) || (tipo === 2 && grupoId === 15);

// Texto recortado al largo de su columna
const texto = (v, largo) => (typeof v === "string" ? v.trim().slice(0, largo) : "");
// Números >= 0 (vacío vale 0); NaN si no lo son
const noNegativo = (v, { entero = false } = {}) => {
  const n = v === undefined || v === null || v === "" ? 0 : Number(v);
  return Number.isFinite(n) && n >= 0 && (!entero || Number.isInteger(n)) ? n : NaN;
};

// Grupos de gasto que NO se cargan como movimiento suelto (origen
// MOVIMIENTO), con el motivo:
//  - los de un colegio o una empresa de transporte: el cobro se carga con su
//    origen (COLEGIO / TRANSPORTE), que crea también la cobranza o el pago;
//    si no, no aparece en sus reportes ni en las cuotas del alumno.
//  - los que mueven cajas de divisas o en dólares: el monto se carga en Gs. y
//    sumarlo tal cual a una caja en moneda extranjera la descuadra.
// Devuelve un Map "TipoGastoId-TipoGastoGrupoId" -> motivo.
const MOTIVOS_NO_SUELTO = {
  COLEGIO: 'Es el grupo de un colegio: elegí "Cobranza de colegio", así se crea también la cobranza del alumno.',
  TRANSPORTE: 'Es el grupo de una empresa de transporte: elegí "Pago de transporte", así se crea también el pago.',
  DIVISA: "Ese grupo mueve cajas de divisas o en dólares: se carga desde su pestaña, con la cotización.",
};
const getGruposNoSueltos = async (q) => {
  const filas = (
    await q.query(
      `SELECT "TipoGastoId", "TipoGastoGrupoId", 'COLEGIO' AS razon FROM "colegio"
        WHERE "TipoGastoId" IS NOT NULL AND "TipoGastoGrupoId" IS NOT NULL
       UNION
       SELECT "TipoGastoId", "TipoGastoGrupoId", 'TRANSPORTE' FROM "transporte"
        WHERE "TipoGastoId" IS NOT NULL AND "TipoGastoGrupoId" IS NOT NULL
       UNION
       SELECT cg."TipoGastoId", cg."TipoGastoGrupoId", 'DIVISA'
         FROM "cajagasto" cg JOIN "caja" c ON c."CajaId" = cg."CajaId"
        WHERE c."CajaTipoId" = 3 OR c."CajaDescripcion" ILIKE '%USD%'`
    )
  ).rows;
  const grupos = new Map();
  for (const f of filas) {
    const clave = `${f.TipoGastoId}-${f.TipoGastoGrupoId}`;
    if (!grupos.has(clave)) grupos.set(clave, MOTIVOS_NO_SUELTO[f.razon]);
  }
  return grupos;
};

// Valida los datos de un movimiento a agregar a un cierre anterior y los
// normaliza. Corre ANTES de abrir la transacción (sólo lecturas).
//   origen "MOVIMIENTO" (Cobranza / Pago / carga manual): tipo, grupoId,
//          detalle y opcionalmente cambio, mtcn y cargo
//   origen "WESTERN" (WesternPagosTab): igual que MOVIMIENTO pero con un
//          grupo Western, y clienteId para el registro en westernenvio
//   origen "JSI": clienteId (y codigoJSI opcional, si el cliente no tiene)
//   origen "COLEGIO" (CobranzaColegiosTab): colegio.{nominaId, mes,
//          mesPagado, diasMora, examen, descuento}. El monto NO se recibe: se
//          calcula con el importe del curso, como en la pestaña.
//   origen "TRANSPORTE" (EmpresasTransporteTab): transporte.{transporteId,
//          clienteId, origen, destino, fechaEmbarque, hora, asiento,
//          numeroBoleto, telefono, clienteRUC}
//   todos: motivo, y monto (salvo COLEGIO)
const validarAlta = async (q, datos) => {
  const esJSI = datos.origen === "JSI";
  const esWestern = datos.origen === "WESTERN";
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";

  if (datos.origen === "COLEGIO") {
    const c = datos.colegio || {};
    const nominaId = Number(c.nominaId);
    const nomina = Number.isInteger(nominaId)
      ? await ColegioCobranza.getNominaConCurso(nominaId, q)
      : null;
    if (!nomina) throw errorConStatus(400, "Elegí el alumno de la cobranza");
    if (Number(nomina.TipoGastoId) !== 2 || !nomina.TipoGastoGrupoId) {
      throw errorConStatus(400, "El colegio del alumno no tiene un grupo de ingreso asignado.");
    }
    const mes = Number(c.mes);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw errorConStatus(400, "La cantidad de meses debe ser entre 1 y 12");
    }
    const mesPagado = texto(c.mesPagado, 30);
    if (!mesPagado) throw errorConStatus(400, "Indicá el mes pagado");
    const diasMora = noNegativo(c.diasMora, { entero: true });
    const examen = noNegativo(c.examen);
    const descuento = noNegativo(c.descuento);
    if ([diasMora, examen, descuento].some(Number.isNaN) || diasMora > 32767) {
      throw errorConStatus(400, "Días de mora, examen y descuento deben ser números no negativos");
    }
    const cobranza = {
      NominaId: nominaId,
      ColegioCobranzaMesPagado: mesPagado,
      ColegioCobranzaMes: mes,
      ColegioCobranzaDiasMora: diasMora,
      ColegioCobranzaExamen: examen,
      ColegioCobranzaDescuento: descuento,
    };
    const importe = Number(nomina.ColegioCursoImporte) || 0;
    // Sin cuota, el total quedaría sólo con mora/examen/descuento
    if (!(importe > 0)) {
      throw errorConStatus(400, "El curso del alumno no tiene la cuota cargada: cargala en el colegio antes.");
    }
    const monto = ColegioCobranza.calcularTotal(cobranza, importe);
    if (!(monto > 0)) throw errorConStatus(400, "El total de la cobranza debe ser mayor a cero");
    if (!motivo) throw errorConStatus(400, "Indicá el motivo");
    return {
      esColegio: true, monto, motivo, tipo: 2, grupoId: Number(nomina.TipoGastoGrupoId),
      nomina, cobranza,
    };
  }

  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw errorConStatus(400, "El monto debe ser un número mayor a cero");
  }
  if (!motivo) throw errorConStatus(400, "Indicá el motivo");

  if (datos.origen === "TRANSPORTE") {
    const t = datos.transporte || {};
    const transporteId = Number(t.transporteId);
    const transporte = Number.isInteger(transporteId)
      ? (
          await q.query(
            `SELECT "TransporteId", TRIM("TransporteNombre") AS "TransporteNombre",
                    "TipoGastoId", "TipoGastoGrupoId"
             FROM "transporte" WHERE "TransporteId" = $1`,
            [transporteId]
          )
        ).rows[0]
      : null;
    if (!transporte) throw errorConStatus(400, "Elegí la empresa de transporte");
    if (Number(transporte.TipoGastoId) !== 2 || !transporte.TipoGastoGrupoId) {
      throw errorConStatus(400, "La empresa de transporte no tiene un grupo de ingreso asignado.");
    }
    const clienteId = Number(t.clienteId);
    const cliente =
      t.clienteId && Number.isInteger(clienteId)
        ? await JSICobro.getClienteParaDetalle(clienteId, q)
        : null;
    if (t.clienteId && !cliente) throw errorConStatus(400, "Cliente no encontrado");
    const origen = texto(t.origen, 30).toUpperCase();
    const destino = texto(t.destino, 30).toUpperCase();
    if (!origen || !destino) throw errorConStatus(400, "Indicá el origen y el destino del pasaje");
    const fechaEmbarque = texto(t.fechaEmbarque, 16);
    if (fechaEmbarque && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(fechaEmbarque)) {
      throw errorConStatus(400, "Fecha de embarque inválida");
    }
    return {
      esTransporte: true, monto, motivo, tipo: 2, grupoId: Number(transporte.TipoGastoGrupoId),
      transporte,
      // Mismos campos que arma EmpresasTransporteTab
      pago: {
        TransporteId: transporte.TransporteId,
        PagoTransOrigen: origen,
        PagoTransDestino: destino,
        PagoTransFechaEmbarque: fechaEmbarque || null,
        PagoTransHora: texto(t.hora, 5),
        PagoTransAsiento: texto(t.asiento, 5),
        PagoTransMonto: monto,
        PagoTransNumeroBoleto: texto(t.numeroBoleto, 20),
        PagoTransNombreApellido: cliente
          ? `${cliente.ClienteNombre ?? ""} ${cliente.ClienteApellido ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 70)
          : "",
        PagoTransCI: "",
        PagoTransTelefono: texto(t.telefono, 20),
        ClienteId: cliente ? cliente.ClienteId : null,
        PagoTransClienteRUC: texto(t.clienteRUC, 20),
      },
    };
  }

  const grupoJSI = await JSICobro.getGrupoIngreso(q);
  if (esJSI) {
    if (!grupoJSI) {
      throw errorConStatus(400, "La caja J.S.I. no tiene un gasto de ingreso configurado.");
    }
    const clienteId = Number(datos.clienteId);
    const cliente = Number.isInteger(clienteId)
      ? await JSICobro.getClienteParaDetalle(clienteId, q)
      : null;
    if (!cliente) throw errorConStatus(400, "Elegí el cliente del cobro de JSI");
    return { esJSI, monto, motivo, tipo: 2, grupoId: grupoJSI, cliente, codigoJSI: datos.codigoJSI };
  }

  const tipo = Number(datos.tipo);
  if (tipo !== 1 && tipo !== 2) throw errorConStatus(400, "Elegí ingreso o egreso");
  const grupoId = Number(datos.grupoId);
  const grupo = (
    await q.query(
      `SELECT TRIM("TipoGastoGrupoDescripcion") AS d FROM "tipogastogrupo"
       WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2`,
      [tipo, grupoId]
    )
  ).rows[0];
  if (!grupo || grupoId === 2) throw errorConStatus(400, "Grupo de gasto inválido");
  const descripcion = grupo.d.toUpperCase();
  if (descripcion.startsWith("PASE ")) {
    throw errorConStatus(400, "Los pases entre cajas no se agregan a un cierre anterior.");
  }
  if (esWestern) {
    if (!esGrupoWestern(descripcion)) throw errorConStatus(400, "Grupo de gasto inválido");
    const conCotizacion = esWesternConCotizacion(tipo, grupoId);
    const cambio = conCotizacion ? Number(datos.cambio) || 0 : 0;
    if (conCotizacion && !(cambio > 0)) {
      throw errorConStatus(400, "Indicá la cotización del dólar para un grupo con cotización.");
    }
    // Cliente y MTCN son obligatorios en WesternPagosTab
    const clienteId = Number(datos.clienteId);
    const cliente = Number.isInteger(clienteId)
      ? await JSICobro.getClienteParaDetalle(clienteId, q)
      : null;
    if (!cliente) throw errorConStatus(400, "Elegí el cliente del Western");
    if (!(Number(datos.mtcn) > 0)) throw errorConStatus(400, "Indicá el MTCN del Western");
    return {
      esJSI, esWestern, monto, motivo, tipo, grupoId, cambio,
      detalle: typeof datos.detalle === "string" ? datos.detalle : "",
      mtcn: Number(datos.mtcn) || 0,
      cargo: tipo === 2 ? Number(datos.cargo) || 0 : 0,
      clienteId,
    };
  }
  // Los Western se cargan desde su pestaña (origen WESTERN), que también crea
  // el registro en westernenvio
  if (esGrupoWestern(descripcion)) {
    throw errorConStatus(400, "Los movimientos Western no se agregan a un cierre anterior.");
  }
  // Un cobro de JSI suelto (sin su registro en jsicobro) no aparecería en
  // los reportes de JSI
  if (tipo === 2 && grupoId === grupoJSI) {
    throw errorConStatus(
      400,
      "Para un cobro de JSI usá la opción \"Cobro de JSI\" (o la pestaña JSI): así se crea también el cobro."
    );
  }
  const noSuelto = (await getGruposNoSueltos(q)).get(`${tipo}-${grupoId}`);
  if (noSuelto) throw errorConStatus(400, noSuelto);
  const detalle =
    (typeof datos.detalle === "string" && datos.detalle.trim()) || "Agregado al cierre";
  return {
    esJSI, monto, motivo, tipo, grupoId, detalle,
    cambio: Number(datos.cambio) || 0,
    mtcn: Number(datos.mtcn) || 0,
    cargo: Number(datos.cargo) || 0,
  };
};

// Agrega a un cierre anterior un movimiento que faltó cargar. Queda asignado a
// ese cierre (cuenta en su ticket y su diferencia, que se recalcula) y no en el
// turno en curso. La caja del cajero no se toca, porque esa plata ya se contó
// en el arqueo; las demás cajas del gasto se mueven como al crearlo desde su
// pestaña (Cobranza / Pago, JSI, colegios y transporte usan la misma regla;
// Western, la suya). Un cobro de JSI crea también el cobro en jsicobro, una
// cobranza de colegio su colegiocobranza y un pago de transporte su pagotrans
// (con la caja y la fecha del cierre, y el detalle de la pestaña que los
// vincula: así se pueden editar o eliminar desde su pantalla), y un Western su
// registro en westernenvio (misma fecha y monto: así queda emparejado, ver
// findByWesternEnvio). Queda auditado (ALTA).
// `q` es el client de una transacción abierta y `cierre` la fila CIERRE,
// bloqueada. `alta` es lo que devuelve validarAlta.
// Devuelve { registro, diferencia, cobroJSI }.
const agregarEnCierre = async (q, { cierre, alta, usuarioId, prefijoMotivo = "" }) => {
  let detalle = alta.detalle;
  let cobroJSI = null;
  if (alta.esJSI) {
    // El cobro se crea con la caja y la fecha del cierre; su registro de caja
    // lleva el detalle de JuntaSaneamientoTab
    cobroJSI = await JSICobro.create(
      {
        CajaId: cierre.CajaId,
        JSICobroFecha: cierre.RegistroDiarioCajaFecha,
        ClienteId: alta.cliente.ClienteId,
        JSICobroMonto: alta.monto,
        JSICobroUsuarioId: usuarioId,
      },
      q
    );
    detalle = JSICobro.detalleRegistro(alta.cliente, cobroJSI.JSICobroId, alta.codigoJSI);
  } else if (alta.esColegio) {
    const cobranza = await ColegioCobranza.create(
      {
        ...alta.cobranza,
        CajaId: cierre.CajaId,
        ColegioCobranzaFecha: cierre.RegistroDiarioCajaFecha,
        UsuarioId: usuarioId,
      },
      q
    );
    detalle = ColegioCobranza.detalleRegistro(alta.nomina, cobranza.ColegioCobranzaId);
  } else if (alta.esTransporte) {
    const pago = await PagoTrans.create(
      {
        ...alta.pago,
        CajaId: cierre.CajaId,
        PagoTransFecha: cierre.RegistroDiarioCajaFecha,
        PagoTransUsuarioId: usuarioId,
      },
      q
    );
    // Formato de EmpresasTransporteTab ("PagoTransId:<id> TransporteId:<id>"
    // lo vincula: ver getRegistros en pagotrans.controller)
    detalle = `Pago Transporte: ${alta.transporte.TransporteNombre.slice(0, 80)} - ${
      alta.pago.PagoTransOrigen
    } a ${alta.pago.PagoTransDestino} | PagoTransId:${pago.PagoTransId} TransporteId:${
      alta.transporte.TransporteId
    }`;
  }

  const registro = await RegistroDiarioCaja.crearEnCierreAnterior(q, {
    cierre,
    TipoGastoId: alta.tipo,
    TipoGastoGrupoId: alta.grupoId,
    Monto: alta.monto,
    Detalle: detalle,
    Cambio: alta.cambio,
    MTCN: alta.mtcn,
    CargoEnvio: alta.cargo,
    UsuarioId: usuarioId,
  });
  // Aplicar el movimiento (revertir un monto negativo) en las demás cajas del
  // gasto, sin tocar la caja del cajero
  if (alta.esWestern) {
    await revertirWestern(q, registro, -alta.monto, true);
    await WesternEnvio.create(
      {
        CajaId: registro.CajaId,
        WesternEnvioFecha: registro.RegistroDiarioCajaFecha,
        TipoGastoId: alta.tipo,
        TipoGastoGrupoId: alta.grupoId,
        WesternEnvioCambio: alta.cambio,
        WesternEnvioDetalle: detalle,
        WesternEnvioMTCN: alta.mtcn,
        WesternEnvioCargoEnvio: alta.cargo,
        WesternEnvioFactura: "",
        WesternEnvioTimbrado: "",
        WesternEnvioMonto: registro.RegistroDiarioCajaMonto,
        WesternEnvioUsuarioId: usuarioId,
        ClienteId: alta.clienteId,
      },
      q
    );
  } else {
    await revertirAperturadaYDemas(q, registro, -alta.monto, true);
  }

  const etiqueta = alta.esJSI
    ? "Cobro de JSI: "
    : alta.esColegio
      ? "Cobranza de colegio: "
      : alta.esTransporte
        ? "Pago de transporte: "
        : alta.esWestern
          ? "Western: "
          : "";
  const motivo = `${prefijoMotivo}${etiqueta}${alta.motivo}`;
  const diferencia = await CierreDiferencia.registrarParaCierre(
    q,
    cierre.RegistroDiarioCajaId,
    `Mov. #${registro.RegistroDiarioCajaId} agregado (${motivo})`
  );
  await RegistroCorreccion.registrar(q, {
    tipo: "ALTA",
    registro: { ...registro, RegistroDiarioCajaMonto: 0, RegistroDiarioCajaDetalle: null },
    montoNuevo: alta.monto,
    detalleNuevo: detalle,
    cierreId: cierre.RegistroDiarioCajaId,
    diferencia,
    motivo,
    usuarioId,
  });
  return { registro, diferencia, cobroJSI };
};

// Lo que haría agregarEnCierre, sin dejar nada escrito, para confirmarlo antes:
//   cajas      cómo cambia el saldo de cada caja. Se aplica el mismo ajuste que
//              agregarEnCierre (revertirWestern o revertirAperturadaYDemas, sin
//              la caja del cajero) dentro de un savepoint, se miden los saldos
//              y se deshace: así coincide con lo que va a pasar, incluidas las
//              conversiones por cotización y las cajas de divisas de Western.
//   duplicados posibles cargas repetidas: movimientos de ese día (cualquier
//              caja) con el mismo grupo y monto; para un colegio, cobranzas
//              del mismo alumno y mes pagado; para un transporte, pagos con el
//              mismo número de boleto; para un Western, el mismo MTCN.
// `q` es el client de una transacción abierta (el llamador la revierte),
// `cierre` la fila CIERRE y `alta` lo que devuelve validarAlta.
const saldosDeCajas = async (q) =>
  new Map(
    (
      await q.query(
        `SELECT "CajaId", TRIM("CajaDescripcion") AS d, "CajaMonto"::float AS m FROM "caja"`
      )
    ).rows.map((c) => [c.CajaId, c])
  );

const previsualizarAlta = async (q, { cierre, alta }) => {
  const grupo = (
    await q.query(
      `SELECT TRIM("TipoGastoGrupoDescripcion") AS d FROM "tipogastogrupo"
       WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2`,
      [alta.tipo, alta.grupoId]
    )
  ).rows[0];

  const registro = {
    CajaId: cierre.CajaId,
    TipoGastoId: alta.tipo,
    TipoGastoGrupoId: alta.grupoId,
    RegistroDiarioCajaCambio: alta.cambio || 0,
    RegistroDiarioCajaDetalle: alta.detalle || "",
  };
  const antes = await saldosDeCajas(q);
  await q.query("SAVEPOINT vista_previa");
  let despues;
  try {
    if (alta.esWestern) await revertirWestern(q, registro, -alta.monto, true);
    else await revertirAperturadaYDemas(q, registro, -alta.monto, true);
    despues = await saldosDeCajas(q);
  } finally {
    await q.query("ROLLBACK TO SAVEPOINT vista_previa");
  }
  const cajas = [...despues.values()]
    .map((c) => ({
      CajaId: c.CajaId,
      CajaDescripcion: c.d,
      Ajuste: Math.round((c.m - antes.get(c.CajaId).m) * 100) / 100,
    }))
    .filter((c) => c.Ajuste !== 0)
    .sort((a, b) => a.CajaDescripcion.localeCompare(b.CajaDescripcion));

  const duplicados = (
    await q.query(
      `SELECT r."RegistroDiarioCajaId" AS "Id",
              to_char(r."RegistroDiarioCajaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha",
              TRIM(c."CajaDescripcion") AS "CajaDescripcion",
              r."RegistroDiarioCajaDetalle" AS "Detalle"
       FROM "registrodiariocaja" r JOIN "caja" c ON c."CajaId" = r."CajaId"
       WHERE r."TipoGastoId" = $1 AND r."TipoGastoGrupoId" = $2
         AND r."RegistroDiarioCajaMonto" = $3
         AND r."RegistroDiarioCajaFecha"::date = $4::timestamp::date
       ORDER BY r."RegistroDiarioCajaId"`,
      [alta.tipo, alta.grupoId, alta.monto, cierre.RegistroDiarioCajaFecha]
    )
  ).rows.map((r) => ({ ...r, Motivo: "Mismo grupo y monto ese día" }));
  if (alta.esColegio) {
    const previas = (
      await q.query(
        `SELECT "ColegioCobranzaId" AS "Id",
                to_char("ColegioCobranzaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha"
         FROM "colegiocobranza"
         WHERE "NominaId" = $1 AND UPPER(TRIM("ColegioCobranzaMesPagado")) = UPPER($2)
         ORDER BY "ColegioCobranzaId"`,
        [alta.cobranza.NominaId, alta.cobranza.ColegioCobranzaMesPagado]
      )
    ).rows;
    for (const p of previas) {
      duplicados.push({
        ...p,
        Detalle: `Cobranza #${p.Id}`,
        Motivo: `El alumno ya tiene una cobranza de ${alta.cobranza.ColegioCobranzaMesPagado}`,
      });
    }
  }
  if (alta.esWestern && alta.mtcn) {
    const previos = (
      await q.query(
        `SELECT r."RegistroDiarioCajaId" AS "Id",
                to_char(r."RegistroDiarioCajaFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha",
                TRIM(c."CajaDescripcion") AS "CajaDescripcion",
                r."RegistroDiarioCajaDetalle" AS "Detalle"
         FROM "registrodiariocaja" r JOIN "caja" c ON c."CajaId" = r."CajaId"
         WHERE r."RegistroDiarioCajaMTCN" = $1
         ORDER BY r."RegistroDiarioCajaId"`,
        [alta.mtcn]
      )
    ).rows;
    for (const p of previos) {
      if (!duplicados.some((d) => d.Id === p.Id)) duplicados.push({ ...p, Motivo: "Mismo MTCN" });
    }
  }
  if (alta.esTransporte && alta.pago.PagoTransNumeroBoleto) {
    const previos = (
      await q.query(
        `SELECT "PagoTransId" AS "Id", to_char("PagoTransFecha", 'YYYY-MM-DD HH24:MI') AS "Fecha"
         FROM "pagotrans"
         WHERE "TransporteId" = $1 AND TRIM("PagoTransNumeroBoleto") = $2
         ORDER BY "PagoTransId"`,
        [alta.transporte.TransporteId, alta.pago.PagoTransNumeroBoleto]
      )
    ).rows;
    for (const p of previos) {
      duplicados.push({ ...p, Detalle: `Pago #${p.Id}`, Motivo: "Mismo número de boleto" });
    }
  }

  return {
    tipo: alta.tipo,
    grupo: grupo ? grupo.d : "",
    monto: alta.monto,
    // Western "USD." (sin cotización): el monto está en dólares
    enDolares: Boolean(alta.esWestern && esGrupoUsd(alta.tipo, alta.grupoId)),
    cambio: alta.cambio || 0,
    cajas,
    duplicados,
  };
};

module.exports = {
  validarAlta,
  agregarEnCierre,
  previsualizarAlta,
  getGruposNoSueltos,
  errorConStatus,
};
