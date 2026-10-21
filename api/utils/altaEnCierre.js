const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");
const JSICobro = require("../models/jsicobro.model");
const { esGrupoWestern, revertirAperturadaYDemas } = require("./ajusteCajas");

const errorConStatus = (status, message) => Object.assign(new Error(message), { status });

// Valida los datos de un movimiento a agregar a un cierre anterior y los
// normaliza. Corre ANTES de abrir la transacción (sólo lecturas).
//   origen "MOVIMIENTO" (Cobranza / Pago / carga manual): tipo, grupoId,
//          detalle y opcionalmente cambio, mtcn y cargo
//   origen "JSI": clienteId (y codigoJSI opcional, si el cliente no tiene)
//   ambos: monto y motivo
const validarAlta = async (q, datos) => {
  const esJSI = datos.origen === "JSI";
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
// pestaña (Cobranza / Pago y JSI usan la misma regla). Un cobro de JSI crea
// también el cobro en jsicobro. Queda auditado (ALTA).
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
  await revertirAperturadaYDemas(q, registro, -alta.monto, true);

  const motivo = `${prefijoMotivo}${alta.esJSI ? "Cobro de JSI: " : ""}${alta.motivo}`;
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
