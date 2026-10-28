const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const JSICobro = require("../models/jsicobro.model");
const {
  validarAlta,
  agregarEnCierre,
  previsualizarAlta,
  getGruposNoSueltos,
  errorConStatus,
} = require("../utils/altaEnCierre");
const { esGrupoWestern } = require("../utils/ajusteCajas");
const db = require("../config/db");

const TIPOS = ["con", "faltante", "sobrante"];

// Un supervisor agrega movimientos sólo a cierres de los últimos DIAS_TOPE
// días (por fecha del cierre, en Paraguay): lo más viejo ya se concilió
const DIAS_TOPE = 15;

exports.getAll = async (req, res) => {
  try {
    const q = req.query;
    const cajaIdNum = parseInt(q.cajaId, 10);
    const result = await CierreDiferencia.getPaginated({
      page: Math.max(1, parseInt(q.page) || 1),
      limit: Math.min(200, Math.max(1, parseInt(q.limit) || 10)),
      fechaDesde: /^\d{4}-\d{2}-\d{2}$/.test(q.fechaDesde || "") ? q.fechaDesde : undefined,
      fechaHasta: /^\d{4}-\d{2}-\d{2}$/.test(q.fechaHasta || "") ? q.fechaHasta : undefined,
      cajaId: Number.isInteger(cajaIdNum) && cajaIdNum > 0 ? cajaIdNum : undefined,
      usuarioId: q.usuarioId || undefined,
      tipo: TIPOS.includes(q.tipo) ? q.tipo : undefined,
      revisado: ["S", "N"].includes(q.revisado) ? q.revisado : undefined,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDetalle = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Id inválido" });
    }
    const detalle = await CierreDiferencia.getDetalle(id);
    if (!detalle) {
      return res.status(404).json({ message: "Diferencia no encontrada" });
    }
    res.json(detalle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRevision = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: "Id inválido" });
    }
    const { observacion, revisado } = req.body || {};
    if (observacion != null && String(observacion).length > 500) {
      return res
        .status(400)
        .json({ message: "La observación no puede superar los 500 caracteres" });
    }
    const actualizado = await CierreDiferencia.updateRevision(
      id,
      { observacion: observacion == null ? "" : String(observacion), revisado: revisado === true },
      req.user.id
    );
    if (!actualizado) {
      return res.status(404).json({ message: "Diferencia no encontrada" });
    }
    res.json(await CierreDiferencia.getDetalle(id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Grupos de gasto para agregar a un cierre:
//   movimiento  los que se agregan como movimiento suelto (origen
//               MOVIMIENTO): sin apertura/cierre (grupo 2), pases, Western, el
//               ingreso de JSI ni los grupos de colegios, transporte y divisas
//               (ver getGruposNoSueltos), que van por su origen o su pestaña.
//   western     los grupos Western (origen WESTERN)
exports.getGruposAlta = async (req, res) => {
  try {
    const noSueltos = await getGruposNoSueltos(db);
    const grupoJSI = await JSICobro.getGrupoIngreso(db);
    const todos = (
      await db.query(
        `SELECT "TipoGastoId", "TipoGastoGrupoId",
                TRIM("TipoGastoGrupoDescripcion") AS "TipoGastoGrupoDescripcion"
         FROM "tipogastogrupo"
         WHERE "TipoGastoGrupoId" <> 2
           AND UPPER(TRIM("TipoGastoGrupoDescripcion")) NOT LIKE 'PASE %'
         ORDER BY 3`
      )
    ).rows;
    res.json({
      movimiento: todos.filter(
        (g) =>
          !esGrupoWestern(g.TipoGastoGrupoDescripcion) &&
          !(g.TipoGastoId === 2 && g.TipoGastoGrupoId === grupoJSI) &&
          !noSueltos.has(`${g.TipoGastoId}-${g.TipoGastoGrupoId}`)
      ),
      western: todos.filter((g) => esGrupoWestern(g.TipoGastoGrupoDescripcion)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Datos del movimiento a agregar, del body (ver agregarMovimiento)
const leerAlta = (body) => ({
  origen: body.Origen,
  tipo: body.TipoGastoId,
  grupoId: body.TipoGastoGrupoId,
  detalle: body.RegistroDiarioCajaDetalle,
  cambio: body.RegistroDiarioCajaCambio,
  mtcn: body.RegistroDiarioCajaMTCN,
  cargo: body.RegistroDiarioCajaCargoEnvio,
  clienteId: body.ClienteId,
  monto: body.RegistroDiarioCajaMonto,
  motivo: body.Motivo,
  colegio: body.Colegio,
  transporte: body.Transporte,
});

// Fila CIERRE `id` (bloqueada con `bloquear`), validando el tope de días.
// Los días se comparan en Paraguay (diaParaguay), sin depender de la zona
// horaria del servidor de base de datos.
const getCierreEditable = async (q, id, { bloquear = false } = {}) => {
  if (!Number.isInteger(id)) throw errorConStatus(400, "Id inválido");
  const cierre = (
    await q.query(
      `SELECT * FROM "registrodiariocaja"
       WHERE "RegistroDiarioCajaId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2
       ${bloquear ? "FOR UPDATE" : ""}`,
      [id]
    )
  ).rows[0];
  if (!cierre) throw errorConStatus(404, "Cierre no encontrado");
  const { diaParaguay } = RegistroDiarioCaja;
  const primerDia = diaParaguay(new Date(Date.now() - DIAS_TOPE * 24 * 3600 * 1000));
  if (diaParaguay(cierre.RegistroDiarioCajaFecha) < primerDia) {
    throw errorConStatus(
      400,
      `Sólo se agregan movimientos a cierres de los últimos ${DIAS_TOPE} días.`
    );
  }
  return cierre;
};

// Lo que haría agregarMovimiento con el mismo body, sin guardar nada: el
// monto (para un colegio, el total calculado), las cajas que se ajustan, los
// posibles duplicados y si el cierre ya estaba revisado (vuelve a pendiente si
// la diferencia cambia). La pantalla lo muestra para confirmar.
// Corre en una transacción que siempre se revierte (previsualizarAlta aplica
// el ajuste de cajas para medirlo y lo deshace).
exports.previsualizarMovimiento = async (req, res) => {
  const client = await db.connect();
  let enTransaccion = false;
  try {
    const id = parseInt(req.params.id, 10);
    const alta = await validarAlta(client, leerAlta(req.body || {}));
    await client.query("BEGIN");
    enTransaccion = true;
    const cierre = await getCierreEditable(client, id);
    const vista = await previsualizarAlta(client, { cierre, alta });
    const revision = (
      await client.query(
        `SELECT "CierreDiferenciaRevisado" AS r FROM "cierrediferencia" WHERE "RegistroDiarioCajaId" = $1`,
        [id]
      )
    ).rows[0];
    res.json({ ...vista, cierreRevisado: Boolean(revision && revision.r) });
  } catch (error) {
    if (!error.status) console.error("Error al previsualizar el movimiento:", error);
    res.status(error.status || 500).json({ message: error.message });
  } finally {
    if (enTransaccion) await client.query("ROLLBACK");
    client.release();
  }
};

// Agregar a un cierre anterior un movimiento que faltó cargar (ej. una
// cobranza que se eliminó y había que volver a cargar), desde Diferencias de
// Cierre (supervisor), en cierres de los últimos DIAS_TOPE días. Ver
// utils/altaEnCierre.js: queda en ese turno, se recalcula su diferencia, la
// caja del cajero no se toca y queda auditado.
// Body:
//   Origen: "MOVIMIENTO" (por defecto: Cobranza / Pago / carga manual),
//           "WESTERN" (pago o envío: crea también el registro en westernenvio),
//           "JSI" (cobro de la Junta de Saneamiento: crea también el cobro),
//           "COLEGIO" (crea también la cobranza del alumno) o
//           "TRANSPORTE" (crea también el pago de transporte)
//   MOVIMIENTO: TipoGastoId (1 egreso, 2 ingreso), TipoGastoGrupoId,
//               RegistroDiarioCajaDetalle
//   WESTERN: TipoGastoId, TipoGastoGrupoId (Western), ClienteId,
//            RegistroDiarioCajaDetalle, RegistroDiarioCajaCambio (grupos con
//            cotización), RegistroDiarioCajaMTCN, RegistroDiarioCajaCargoEnvio
//            (envíos). El monto va en Gs. (en los grupos USD., en dólares)
//   JSI: ClienteId
//   COLEGIO: Colegio { nominaId, mes, mesPagado, diasMora, examen, descuento }
//            (sin monto: se calcula con el importe del curso)
//   TRANSPORTE: Transporte { transporteId, clienteId, origen, destino,
//            fechaEmbarque, hora, asiento, numeroBoleto, telefono, clienteRUC }
//   Todos: Motivo y RegistroDiarioCajaMonto (salvo COLEGIO)
exports.agregarMovimiento = async (req, res) => {
  const client = await db.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw errorConStatus(400, "Id inválido");
    const alta = await validarAlta(client, leerAlta(req.body || {}));

    await client.query("BEGIN");
    const cierre = await getCierreEditable(client, id, { bloquear: true });
    const { registro, diferencia } = await agregarEnCierre(client, {
      cierre,
      alta,
      usuarioId: req.user.id,
    });
    await client.query("COMMIT");

    const creado = alta.esJSI
      ? "Cobro de JSI agregado al cierre: se creó el cobro"
      : alta.esWestern
        ? "Western agregado al cierre: se creó también su registro de Western"
        : alta.esColegio
          ? "Cobranza de colegio agregada al cierre: se creó la cobranza del alumno"
          : alta.esTransporte
            ? "Pago de transporte agregado al cierre: se creó el pago"
            : "Movimiento agregado al cierre";
    res.status(201).json({
      message: `${creado}, se recalculó la diferencia y el turno en curso no cambió.`,
      data: { registro, diferencia, detalle: await CierreDiferencia.getDetalle(id) },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (!error.status) console.error("Error al agregar movimiento al cierre:", error);
    res.status(error.status || 500).json({ message: error.message });
  } finally {
    client.release();
  }
};
