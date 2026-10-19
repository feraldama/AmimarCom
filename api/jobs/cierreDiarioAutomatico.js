const CierreDiario = require("../models/cierrediario.model");

// Cierre Diario Gerencial automático: todos los días a partir de las 23:00
// hora de Paraguay registra el snapshot de saldos de todas las cajas.
//
// - Hora real de Paraguay: se toma con la zona "America/Asuncion", no con la
//   hora del servidor (que en el VPS puede estar en UTC). La fecha del cierre
//   también la calcula la DB en esa zona (ver registrarSnapshot).
// - No duplica: registrarSnapshot verifica dentro de una transacción con lock
//   si ya existe el cierre del día (hecho a mano o por una corrida anterior) y
//   en ese caso no inserta nada.
// - Se revisa cada minuto en vez de programar un único disparo: si la API se
//   reinicia o la DB falla a las 23:00, se reintenta hasta las 23:59.
// - Si hay cajas abiertas se registra igual (no hay nadie para confirmar) y
//   se deja constancia en el log.
//
// Se desactiva con CIERRE_DIARIO_AUTO=0 en el .env.

const ZONA = "America/Asuncion";
const HORA_CIERRE = 23;
const INTERVALO_MS = 60 * 1000;

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

// Fecha (YYYY-MM-DD) y hora en Paraguay del instante dado (por defecto, ahora)
function ahoraParaguay(ahora = new Date()) {
  const partes = Object.fromEntries(
    formato.formatToParts(ahora).map((p) => [p.type, p.value])
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
  };
}

// Último día ya resuelto (registrado o encontrado existente), para no
// consultar la DB cada minuto entre las 23:00 y las 23:59.
let fechaResuelta = null;
let corriendo = false;

async function revisar() {
  const { fecha, hora } = ahoraParaguay();
  if (hora < HORA_CIERRE || fechaResuelta === fecha || corriendo) return;
  corriendo = true;
  try {
    const result = await CierreDiario.registrarSnapshot({ forzar: true });
    if (result.estado === "existe") {
      console.log(
        `[cierre-diario] ${result.fecha}: ya estaba registrado (${result.existing} cajas), no se repite.`
      );
    } else {
      const abiertas = result.abiertas || [];
      console.log(
        `[cierre-diario] ${result.fecha}: registrado automáticamente para ${result.inserted} cajas.` +
          (abiertas.length
            ? ` Cajas abiertas (saldo teórico): ${abiertas
                .map((c) => `${c.CajaDescripcion.trim()} (${c.UsuarioId})`)
                .join(", ")}.`
            : "")
      );
    }
    fechaResuelta = fecha;
  } catch (error) {
    // No se marca como resuelto: se reintenta en el próximo minuto
    console.error("[cierre-diario] Error al registrar el cierre automático:", error.message);
  } finally {
    corriendo = false;
  }
}

function iniciarCierreDiarioAutomatico() {
  if (process.env.CIERRE_DIARIO_AUTO === "0") {
    console.log("[cierre-diario] Cierre automático desactivado (CIERRE_DIARIO_AUTO=0).");
    return;
  }
  console.log(
    `[cierre-diario] Cierre automático activo: todos los días a las ${HORA_CIERRE}:00 (${ZONA}).`
  );
  revisar();
  setInterval(revisar, INTERVALO_MS);
}

module.exports = { iniciarCierreDiarioAutomatico, ahoraParaguay };
