const db = require("../config/db");

// Auditoría de correcciones y eliminaciones de movimientos de caja (ver
// migrations/2026-10-21_registrocorreccion.sql).

const RegistroCorreccion = {
  // tipo: "CORRECCION" | "ELIMINACION". `registro` es la fila tal como estaba
  // antes del cambio; `diferencia` es lo que devuelve
  // CierreDiferencia.registrarParaCierre (o null si el turno estaba abierto).
  // `q` es el client de la transacción del cambio.
  registrar: async (
    q,
    { tipo, registro, montoNuevo, detalleNuevo, cierreId, diferencia, motivo, usuarioId }
  ) => {
    await (q || db).query(
      `INSERT INTO "registrocorreccion" (
         "RegistroDiarioCajaId", "RegistroCorreccionTipo", "CajaId",
         "RegistroCorreccionCierreId", "RegistroCorreccionMontoAnterior",
         "RegistroCorreccionMontoNuevo", "RegistroCorreccionDetalleAnterior",
         "RegistroCorreccionDetalleNuevo", "RegistroCorreccionDiferenciaAnterior",
         "RegistroCorreccionDiferenciaNueva", "RegistroCorreccionMotivo", "UsuarioId"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, LEFT($11, 500), $12)`,
      [
        registro.RegistroDiarioCajaId,
        tipo,
        registro.CajaId,
        cierreId || null,
        Number(registro.RegistroDiarioCajaMonto) || 0,
        montoNuevo ?? null,
        registro.RegistroDiarioCajaDetalle ?? null,
        detalleNuevo ?? null,
        diferencia?.anterior ?? null,
        diferencia?.nueva ?? null,
        motivo,
        String(usuarioId),
      ]
    );
  },
};

module.exports = RegistroCorreccion;
