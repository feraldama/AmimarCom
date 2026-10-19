const CajaCereo = require("../models/cajacereo.model");
const { ahoraParaguay } = require("./cierreDiarioAutomatico");

// Cereo mensual: el día 1 de cada mes a las 00:00 (hora de Paraguay) pone en
// 0 las cajas de colegios y de anticipos (ver CajaCereo.cerearMes). El saldo
// de fin de mes queda en el Cierre Diario de las 23:00 del último día, en la
// tabla `cajacereo` y en el log.
//
// - Se revisa cada minuto: si la API se reinicia o la DB falla a las 00:00, se
//   reintenta. Sólo dentro de la ventana 00:00–05:59 del día 1: más tarde ya
//   puede haber movimientos del mes nuevo que el cereo borraría, así que si se
//   pasó la ventana no se cerea y se avisa en el log.
// - No duplica: la marca del mes en `cajacereo` evita cerear dos veces aunque
//   la API se reinicie ese día.
//
// Se desactiva con CEREO_MENSUAL_AUTO=0 en el .env.

const HORA_LIMITE = 6;
const INTERVALO_MS = 60 * 1000;

// Último mes ya resuelto, para no consultar la DB cada minuto de la ventana
let mesResuelto = null;
let corriendo = false;

async function revisar() {
  const { fecha, hora } = ahoraParaguay();
  if (!fecha.endsWith("-01") || mesResuelto === fecha || corriendo) return;
  if (hora >= HORA_LIMITE) {
    mesResuelto = fecha;
    // Si ya se hizo en la ventana no hay nada que avisar
    const r = await CajaCereo.cerearMes(fecha, { simular: true }).catch(() => null);
    if (r && r.estado !== "existe") {
      console.error(
        `[cereo-mensual] ${fecha}: NO se cereó (la API no estuvo activa entre las 00:00 y las ${HORA_LIMITE}:00). Hay que cerear las cajas a mano.`
      );
    }
    return;
  }
  corriendo = true;
  try {
    const result = await CajaCereo.cerearMes(fecha);
    if (result.estado === "existe") {
      console.log(`[cereo-mensual] ${fecha}: ya estaba cereado, no se repite.`);
    } else {
      console.log(
        `[cereo-mensual] ${fecha}: ${result.cajas.length} cajas en 0. Saldos anteriores: ` +
          result.cajas
            .map((c) => `${c.CajaDescripcion} (${c.CajaId}) ${Number(c.CajaMonto)}`)
            .join(", ")
      );
    }
    mesResuelto = fecha;
  } catch (error) {
    // No se marca como resuelto: se reintenta en el próximo minuto
    console.error("[cereo-mensual] Error al cerear las cajas:", error.message);
  } finally {
    corriendo = false;
  }
}

function iniciarCereoMensual() {
  if (process.env.CEREO_MENSUAL_AUTO === "0") {
    console.log("[cereo-mensual] Cereo mensual desactivado (CEREO_MENSUAL_AUTO=0).");
    return;
  }
  console.log(
    "[cereo-mensual] Cereo mensual activo: el día 1 de cada mes a las 00:00 (America/Asuncion)."
  );
  revisar();
  setInterval(revisar, INTERVALO_MS);
}

module.exports = { iniciarCereoMensual };
