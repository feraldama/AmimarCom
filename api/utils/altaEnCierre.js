const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");
const JSICobro = require("../models/jsicobro.model");
const WesternEnvio = require("../models/westernenvio.model");
const { esGrupoWestern, revertirAperturadaYDemas, revertirWestern } = require("./ajusteCajas");

const errorConStatus = (status, message) => Object.assign(new Error(message), { status });

// Grupos "USD CON COTIZACION" de Western (pagos 8, envíos 15): sólo en ellos
// se guarda el cambio (igual que WesternPagosTab)
const esWesternConCotizacion = (tipo, grupoId) =>
  (tipo === 1 && grupoId === 8) || (tipo === 2 && grupoId === 15);

// Valida los datos de un movimiento a agregar a un cierre anterior y los
// normaliza. Corre ANTES de abrir la transacción (sólo lecturas).
//   origen "MOVIMIENTO" (Cobranza / Pago / carga manual): tipo, grupoId,
//          detalle y opcionalmente cambio, mtcn y cargo
//   origen "WESTERN" (WesternPagosTab): igual que MOVIMIENTO pero con un
//          grupo Western, y clienteId para el registro en westernenvio
//   origen "JSI": clienteId (y codigoJSI opcional, si el cliente no tiene)
//   todos: monto y motivo
const validarAlta = async (q, datos) => {
  const esJSI = datos.origen === "JSI";
  const esWestern = datos.origen === "WESTERN";
  const monto = Number(datos.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw errorConStatus(400, "El monto debe ser un número mayor a cero");
  }
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  if (!motivo) throw errorConStatus(400, "Indicá el motivo");

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
    const clienteId = Number(datos.clienteId);
    return {
      esJSI, esWestern, monto, motivo, tipo, grupoId, cambio,
      detalle: typeof datos.detalle === "string" ? datos.detalle : "",
      mtcn: Number(datos.mtcn) || 0,
      cargo: tipo === 2 ? Number(datos.cargo) || 0 : 0,
      clienteId: Number.isInteger(clienteId) ? clienteId : null,
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
// pestaña (Cobranza / Pago y JSI usan la misma regla; Western, la suya). Un
// cobro de JSI crea también el cobro en jsicobro, y un Western su registro en
// westernenvio (misma fecha y monto: así queda emparejado, ver
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

  const etiqueta = alta.esJSI ? "Cobro de JSI: " : alta.esWestern ? "Western: " : "";
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

module.exports = { validarAlta, agregarEnCierre, errorConStatus };
