const CajaGasto = require("../models/cajagasto.model");

// Lógica de saldos (CajaMonto) de un movimiento de registrodiariocaja,
// compartida por la eliminación y la corrección de movimientos.

// Registros de PAGO ADMIN: sus saldos los maneja pagoadmin.controller.js.
// Usan TipoGastoId=1, TipoGastoGrupoId=21 para el egreso y TipoGastoId=2,
// TipoGastoGrupoId=26 para el ingreso.
const esRegistroPagoAdmin = ({
  TipoGastoId,
  TipoGastoGrupoId,
  RegistroDiarioCajaDetalle,
}) =>
  (TipoGastoId === 1 && TipoGastoGrupoId === 21) ||
  (TipoGastoId === 2 && TipoGastoGrupoId === 26) ||
  Boolean(
    RegistroDiarioCajaDetalle && RegistroDiarioCajaDetalle.includes("PAGO ADMIN")
  );

// Suma `monto` (con signo) al saldo de la caja en un solo UPDATE, sin leer y
// reescribir el saldo: así no se pisa un movimiento que otra operación esté
// aplicando a la misma caja al mismo tiempo.
const sumarACaja = (q, cajaId, monto) =>
  q.query('UPDATE "caja" SET "CajaMonto" = "CajaMonto" + $1 WHERE "CajaId" = $2', [
    monto,
    cajaId,
  ]);

// Revierte en las cajas el efecto de `monto` del movimiento `registro`: la
// caja del registro (aperturada) y las demás cajas con el mismo gasto en
// cajagasto. Con un monto negativo aplica el efecto en vez de revertirlo, así
// una corrección de X a Y es revertir (X - Y).
// `omitirCajaRegistro`: no toca la caja del registro. Se usa cuando el
// movimiento es de un turno ya cerrado: esa plata ya se contó en el arqueo del
// cierre y la caja quedó con lo contado, así que el turno en curso no cambia.
const revertirEnCajas = async (
  q,
  registro,
  monto,
  { omitirCajaRegistro = false } = {}
) => {
  const {
    CajaId,
    TipoGastoId,
    TipoGastoGrupoId,
    RegistroDiarioCajaCambio,
    RegistroDiarioCajaDetalle,
  } = registro;

  // Al revertir invertimos la operación:
  // - Si era egreso (restó), ahora sumamos
  // - Si era ingreso (sumó), ahora restamos
  const esIngreso = TipoGastoId === 2;
  const cambio = Number(RegistroDiarioCajaCambio) || 0;

  // Detectar si el registro proviene de un movimiento de divisa
  // (DivisasTab COMPRA/VENTA). En esos casos las cajas DIVISA (TipoId=3)
  // siguen una convención opuesta a Western: la creación SUMA cantidad a
  // la DIVISA al COMPRAR y RESTA al VENDER, así que el reverso debe
  // RESTAR/SUMAR sin la inversión de signo extra que aplica el flujo
  // Western.
  const detalleNorm = (RegistroDiarioCajaDetalle || "").trim();
  const esDivisaMovimiento =
    detalleNorm.startsWith("Compra DivisaMovimientoId:") ||
    detalleNorm.startsWith("Venta DivisaMovimientoId:");

  // Verificar casos especiales para WESTERN PAGOS USD CON COTIZACION
  // Grupos vigentes: 8 (USD COTIZACION) y 13. Se mantiene 19 por compatibilidad
  // con datos previos a la migración del grupo USD COTIZACION (19 -> 8).
  const esCasoEspecialUSDCotPagos =
    TipoGastoId === 1 && (TipoGastoGrupoId === 8 || TipoGastoGrupoId === 19);
  const esCasoEspecial13 = TipoGastoId === 1 && TipoGastoGrupoId === 13;
  const esCasoEspecial4 = TipoGastoId === 1 && TipoGastoGrupoId === 4; // PAGOS: suma a demás cajas
  const esCasoEspecialUSDPagos = TipoGastoId === 1 && TipoGastoGrupoId === 20; // PAGOS USD puro: aperturada GS no participa
  // Verificar casos especiales para WESTERN ENVÍOS (opuestos a los de pagos).
  // Grupos vigentes: 15 (USD COTIZACION) y 13. Se mantiene 24 por compatibilidad.
  const esCasoEspecialUSDCotEnvios =
    TipoGastoId === 2 && (TipoGastoGrupoId === 15 || TipoGastoGrupoId === 24);
  const esCasoEspecial13Envios = TipoGastoId === 2 && TipoGastoGrupoId === 13;
  const esCasoEspecial5 = TipoGastoId === 2 && TipoGastoGrupoId === 5; // ENVÍOS: resta a demás cajas
  const esCasoEspecialUSDEnvios = TipoGastoId === 2 && TipoGastoGrupoId === 28; // ENVÍOS USD puro: aperturada GS no participa
  const cambioNumero = cambio > 0 ? cambio : 1; // Evitar división por 0

  // Separar la caja del registro de las demás cajas
  const cajaIdRegistro = CajaId ? Number(CajaId) : null;
  const cajasIdsConGasto = new Set();

  // Obtener todas las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId en cajagasto
  if (TipoGastoId && TipoGastoGrupoId) {
    const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
      TipoGastoId,
      TipoGastoGrupoId
    );
    cajasConGasto.forEach((cajaGasto) => {
      if (cajaGasto.CajaId) {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      }
    });
  }

  // Actualizar la caja del registro (caja aperturada)
  if (
    cajaIdRegistro &&
    !omitirCajaRegistro &&
    !esCasoEspecial13Envios &&
    !esCasoEspecialUSDPagos &&
    !esCasoEspecialUSDEnvios
  ) {
    // Casos especiales USD puro (20/28): no tocar la caja aperturada al eliminar.
    // El grupo 13 (EXTRACCIONES) SÍ se revierte aquí: al crearse desde la
    // pestaña Pago se debita la caja aperturada, por lo que al eliminar hay
    // que devolverle el monto (antes se salteaba y la plata no volvía).
    const cajaResult = await q.query(
      'SELECT "CajaTipoId" FROM "caja" WHERE "CajaId" = $1',
      [cajaIdRegistro]
    );
    const cajaActual = cajaResult.rows.length > 0 ? cajaResult.rows[0] : null;

    if (cajaActual) {
      const cajaTipoId = Number(cajaActual.CajaTipoId);

      // Al eliminar, revertir la operación según la nueva lógica:
      // - Si era EGRESO: se había restado, ahora SUMAR
      // - Si era INGRESO: se había sumado, ahora RESTAR
      const esEgreso = TipoGastoId === 1;
      let montoAplicar;
      if (esEgreso) {
        // EGRESO: revertir la resta (sumar)
        montoAplicar = monto;
      } else if (esIngreso) {
        // INGRESO: revertir la suma (restar)
        montoAplicar = -monto;
      } else {
        // Por defecto, mantener lógica anterior
        montoAplicar = esIngreso ? -monto : monto;
      }

      if (cajaTipoId === 3) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = -montoAplicar;
      }

      await sumarACaja(q, cajaIdRegistro, montoAplicar);
    }
  }

  // Actualizar las demás cajas
  const cajasParaActualizar = Array.from(cajasIdsConGasto).filter(
    (id) => id !== cajaIdRegistro
  );

  for (const cajaIdParaActualizar of cajasParaActualizar) {
    const cajaResult2 = await q.query(
      'SELECT "CajaTipoId" FROM "caja" WHERE "CajaId" = $1',
      [cajaIdParaActualizar]
    );
    const cajaActual = cajaResult2.rows.length > 0 ? cajaResult2.rows[0] : null;
    if (!cajaActual) continue;

    const cajaTipoId = Number(cajaActual.CajaTipoId);
    let ajuste;

    if (esCasoEspecialUSDCotPagos || esCasoEspecial13) {
      // Casos especiales de PAGOS: revertir la suma de Monto/CambioDolar (restar)
      const montoConvertido = monto / cambioNumero;
      let montoAplicar = -montoConvertido; // Revertir: restar

      if (cajaTipoId === 3) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = montoConvertido;
      }

      ajuste = montoAplicar;
    } else if (esCasoEspecialUSDCotEnvios || esCasoEspecial13Envios) {
      // Casos especiales de ENVÍOS: revertir la resta de Monto/CambioDolar (sumar)
      const montoConvertido = monto / cambioNumero;
      let montoAplicar = montoConvertido; // Revertir: sumar (opuesto a pagos)

      if (cajaTipoId === 3) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = -montoConvertido;
      }

      ajuste = montoAplicar;
    } else if (esCasoEspecial4) {
      // Caso especial 4 (PAGOS): se había sumado a las demás cajas, al eliminar RESTAR
      // Misma lógica que CobranzaTab para EGRESO
      let valorAUsar = monto;
      if (cajaTipoId === 3 && cambio > 0) {
        valorAUsar = monto / cambio;
      }

      let montoAplicar = -valorAUsar; // Revertir: restar

      if (cajaTipoId === 3) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = -montoAplicar;
      }

      ajuste = montoAplicar;
    } else if (esCasoEspecial5) {
      // Caso especial 5 (ENVÍOS): se había restado a las demás cajas, al eliminar SUMAR
      // Misma lógica que CobranzaTab para INGRESO
      let valorAUsar = monto;
      if (cajaTipoId === 3 && cambio > 0) {
        valorAUsar = monto / cambio;
      }

      let montoAplicar = valorAUsar; // Revertir: sumar

      if (cajaTipoId === 3) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = -montoAplicar;
      }

      ajuste = montoAplicar;
    } else {
      // Caso normal: revertir la operación según la nueva lógica.
      // Para cajaTipoId=3 (DIVISAS), dividir por cambio sólo si el
      // movimiento original era en GS con cotización (no para
      // grupos USD-puros 20/28, donde el monto ya está en USD).
      let valorAUsar = monto;
      if (
        cajaTipoId === 3 &&
        cambio > 0 &&
        !esCasoEspecialUSDPagos &&
        !esCasoEspecialUSDEnvios
      ) {
        valorAUsar = monto / cambio;
      }

      const esEgreso = TipoGastoId === 1;
      let montoAplicar;
      if (esEgreso) {
        // EGRESO: se había sumado a las demás cajas, al eliminar RESTAR
        montoAplicar = -valorAUsar;
      } else if (esIngreso) {
        // INGRESO: se había restado a las demás cajas, al eliminar SUMAR
        montoAplicar = valorAUsar;
      } else {
        // Por defecto, mantener lógica anterior
        if (esIngreso) {
          montoAplicar = -valorAUsar;
        } else {
          montoAplicar = valorAUsar;
        }
      }

      // Inversión para cajaTipoId=3 sólo aplica al flujo Western
      // (donde la DIVISA pierde plata al crear). En divisamovimiento
      // la convención es opuesta (DIVISA gana al comprar / pierde al
      // vender), así que NO invertimos el signo.
      if (cajaTipoId === 3 && !esDivisaMovimiento) {
        // Operación opuesta para CajaTipoId=3
        montoAplicar = -montoAplicar;
      }

      ajuste = montoAplicar;
    }

    await sumarACaja(q, cajaIdParaActualizar, ajuste);
  }
};

// Las estrategias de abajo tienen todas la firma
//   (q, registro, monto, omitirCajaRegistro)
// para usarlas con aplicarEnTurno (utils/correccionTurno.js): revierten el
// efecto de `monto` (negativo: lo aplican) y, con `omitirCajaRegistro`, no
// tocan la caja del registro (turno ya cerrado).

// Cobranzas de colegio, cobros de JSI, pagos de transporte, y CobranzaTab /
// PagoTab: al crearse, la caja aperturada y las demás cajas con el gasto se
// movieron en direcciones OPUESTAS (ver el handleSubmit de cada tab):
//   INGRESO -> aperturada +monto, demás -monto
//   EGRESO  -> aperturada -monto, demás +monto
const revertirAperturadaYDemas = async (q, registro, monto, omitirCajaRegistro) => {
  const esIngreso = registro.TipoGastoId === 2;
  const cajaRegistro = registro.CajaId ? Number(registro.CajaId) : null;

  if (cajaRegistro && !omitirCajaRegistro) {
    await sumarACaja(q, cajaRegistro, esIngreso ? -monto : monto);
  }
  if (registro.TipoGastoId && registro.TipoGastoGrupoId) {
    const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
      registro.TipoGastoId,
      registro.TipoGastoGrupoId
    );
    const demas = new Set(
      cajasConGasto
        .map((cajaGasto) => Number(cajaGasto.CajaId))
        .filter((id) => id && id !== cajaRegistro)
    );
    for (const cajaId of demas) {
      await sumarACaja(q, cajaId, esIngreso ? monto : -monto);
    }
  }
};

// Movimientos Western (WesternPagosTab): las reglas de revertirEnCajas, que
// replican las del tab (grupos USD puro que no tocan la caja abierta,
// conversión por cotización, signo opuesto en cajas de divisa). Además, un
// pago con el grupo 13 (EXTRACCIONES) no tocó la caja abierta al crearse
// desde Western, así que tampoco se le revierte.
const revertirWestern = (q, registro, monto, omitirCajaRegistro) =>
  revertirEnCajas(q, registro, monto, {
    omitirCajaRegistro:
      omitirCajaRegistro ||
      (registro.TipoGastoId === 1 && registro.TipoGastoGrupoId === 13),
  });

// Descripción del grupo de gasto del registro (la trae si no vino en la fila)
const grupoDescripcion = async (q, registro) => {
  if (registro.TipoGastoGrupoDescripcion !== undefined) {
    return String(registro.TipoGastoGrupoDescripcion || "");
  }
  const result = await q.query(
    `SELECT "TipoGastoGrupoDescripcion" FROM "tipogastogrupo"
     WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2`,
    [registro.TipoGastoId, registro.TipoGastoGrupoId]
  );
  return String(result.rows[0]?.TipoGastoGrupoDescripcion || "");
};

const esGrupoWestern = (descripcion) => descripcion.toUpperCase().includes("WESTERN");

// Movimientos de Registro Diario: cada uno se revierte con la regla de la
// pantalla que lo creó, según su origen (no por número de grupo: los mismos
// números son Western en unos tipos de gasto y colegios en otros).
//   PAGO ADMIN   -> no toca saldos acá (lo hace pagoadmin.controller.js)
//   divisas      -> revertirEnCajas (convención de DivisasTab: monto/cambio
//                   en la caja de divisa, sin invertir el signo)
//   Western      -> revertirWestern
//   el resto     -> revertirAperturadaYDemas (CobranzaTab, PagoTab y carga
//                   manual: caja abierta y demás cajas en sentido opuesto,
//                   sin conversión por tipo de caja)
const revertirMovimiento = async (q, registro, monto, omitirCajaRegistro) => {
  if (esRegistroPagoAdmin(registro)) return;
  const detalle = registro.RegistroDiarioCajaDetalle || "";
  if (detalle.includes("DivisaMovimientoId:")) {
    await revertirEnCajas(q, registro, monto, { omitirCajaRegistro });
  } else if (esGrupoWestern(await grupoDescripcion(q, registro))) {
    await revertirWestern(q, registro, monto, omitirCajaRegistro);
  } else {
    await revertirAperturadaYDemas(q, registro, monto, omitirCajaRegistro);
  }
};

module.exports = {
  esRegistroPagoAdmin,
  esGrupoWestern,
  revertirEnCajas,
  revertirMovimiento,
  revertirAperturadaYDemas,
  revertirWestern,
};
