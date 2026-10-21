const CierreDiferencia = require("../models/cierrediferencia.model");
const { validarAlta, agregarEnCierre, errorConStatus } = require("../utils/altaEnCierre");
const db = require("../config/db");

const TIPOS = ["con", "faltante", "sobrante"];

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

// Agregar a un cierre anterior un movimiento que faltó cargar (ej. una
// cobranza que se eliminó y había que volver a cargar), desde Diferencias de
// Cierre (supervisor). Ver utils/altaEnCierre.js: queda en ese turno, se
// recalcula su diferencia, la caja del cajero no se toca y queda auditado.
// Body:
//   Origen: "MOVIMIENTO" (por defecto: Cobranza / Pago / carga manual) o
//           "JSI" (cobro de la Junta de Saneamiento: crea también el cobro)
//   MOVIMIENTO: TipoGastoId (1 egreso, 2 ingreso), TipoGastoGrupoId,
//               RegistroDiarioCajaDetalle
//   JSI: ClienteId
//   Ambos: RegistroDiarioCajaMonto, Motivo
exports.agregarMovimiento = async (req, res) => {
  const client = await db.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw errorConStatus(400, "Id inválido");
    const alta = await validarAlta(client, {
      origen: req.body.Origen,
      tipo: req.body.TipoGastoId,
      grupoId: req.body.TipoGastoGrupoId,
      detalle: req.body.RegistroDiarioCajaDetalle,
      clienteId: req.body.ClienteId,
      monto: req.body.RegistroDiarioCajaMonto,
      motivo: req.body.Motivo,
    });

    await client.query("BEGIN");
    const cierre = (
      await client.query(
        `SELECT * FROM "registrodiariocaja"
         WHERE "RegistroDiarioCajaId" = $1 AND "TipoGastoId" = 1 AND "TipoGastoGrupoId" = 2
         FOR UPDATE`,
        [id]
      )
    ).rows[0];
    if (!cierre) throw errorConStatus(404, "Cierre no encontrado");
    const { registro, diferencia } = await agregarEnCierre(client, {
      cierre,
      alta,
      usuarioId: req.user.id,
    });
    await client.query("COMMIT");

    res.status(201).json({
      message: alta.esJSI
        ? "Cobro de JSI agregado al cierre: se creó el cobro, se recalculó la diferencia y el turno en curso no cambió."
        : "Movimiento agregado al cierre: se recalculó su diferencia y el turno en curso no cambió.",
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
