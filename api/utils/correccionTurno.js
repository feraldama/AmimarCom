const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");

// Corrige el monto (o elimina) un movimiento de caja respetando su turno. Es
// el paso común de Registro Diario, cobranzas de colegio, cobros de JSI y
// pagos de transporte; cada uno aporta su estrategia de saldos (`revertir`,
// ver utils/ajusteCajas.js).
//
// El movimiento conserva su ID, así sigue en su turno. Si ese turno ya se
// cerró, la caja del registro no se toca (lo contado en el arqueo ya quedó
// como saldo), se recalcula la diferencia de ese cierre y queda auditado.
// Las correcciones se auditan siempre que cambien algo.
//
// `q` es el client de una transacción ya abierta y `registro` la fila tal como
// estaba (idealmente leída con FOR UPDATE).
// opciones:
//   eliminar      true para borrar el movimiento
//   montoNuevo    monto corregido (si no se elimina)
//   detalleNuevo  detalle corregido (opcional; por defecto el actual)
//   revertir      estrategia de saldos (q, registro, monto, omitirCajaRegistro)
//   motivo        por qué se hace (auditoría y nota en la diferencia)
//   usuarioId     quién lo hace
// Devuelve { cierreId, diferencia } (null/null si el turno estaba abierto).
const aplicarEnTurno = async (
  q,
  registro,
  { eliminar = false, montoNuevo, detalleNuevo, revertir, motivo, usuarioId }
) => {
  const montoViejo = Number(registro.RegistroDiarioCajaMonto) || 0;
  const detalle = detalleNuevo ?? registro.RegistroDiarioCajaDetalle;
  const cierreId = await RegistroDiarioCaja.getCierreDeTurnoCerrado(registro, q);

  const ajuste = eliminar ? montoViejo : montoViejo - Number(montoNuevo);
  if (ajuste !== 0) await revertir(q, registro, ajuste, Boolean(cierreId));

  if (eliminar) {
    await RegistroDiarioCaja.delete(registro.RegistroDiarioCajaId, q);
  } else {
    await q.query(
      `UPDATE "registrodiariocaja"
       SET "RegistroDiarioCajaMonto" = $1, "RegistroDiarioCajaDetalle" = $2
       WHERE "RegistroDiarioCajaId" = $3`,
      [montoNuevo, detalle, registro.RegistroDiarioCajaId]
    );
  }

  const accion = eliminar ? "eliminado" : "corregido";
  const diferencia = cierreId
    ? await CierreDiferencia.registrarParaCierre(
        q,
        cierreId,
        `Mov. #${registro.RegistroDiarioCajaId} ${accion} (${motivo})`
      )
    : null;

  const cambio = eliminar || ajuste !== 0 || detalle !== registro.RegistroDiarioCajaDetalle;
  if (cambio && (cierreId || !eliminar)) {
    await RegistroCorreccion.registrar(q, {
      tipo: eliminar ? "ELIMINACION" : "CORRECCION",
      registro,
      montoNuevo: eliminar ? null : montoNuevo,
      detalleNuevo: eliminar ? null : detalle,
      cierreId,
      diferencia,
      motivo,
      usuarioId,
    });
  }
  return { cierreId, diferencia };
};

// Motivo de una eliminación: el que mandó el usuario o uno genérico (los
// borrados internos, como el del registro de un envío Western, no lo traen).
const motivoEliminacion = (req, porDefecto) => {
  const motivo = typeof req.body?.Motivo === "string" ? req.body.Motivo.trim() : "";
  return motivo || porDefecto;
};

module.exports = { aplicarEnTurno, motivoEliminacion };
