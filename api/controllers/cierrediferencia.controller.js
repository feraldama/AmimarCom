const CierreDiferencia = require("../models/cierrediferencia.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const RegistroCorreccion = require("../models/registrocorreccion.model");
const JSICobro = require("../models/jsicobro.model");
const { esGrupoWestern, revertirAperturadaYDemas } = require("../utils/ajusteCajas");
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
// cobranza que se eliminó y había que volver a cargar). Queda asignado a ese
// cierre: cuenta en su ticket y su diferencia, que se recalcula, y no en el
// turno en curso (por eso no se puede cargar con fecha atrasada desde las
// pestañas de caja). La caja del cajero no se toca, porque esa plata ya se
// contó en el arqueo; las demás cajas del gasto se mueven como al crearlo
// desde su pestaña. Exige motivo y queda auditado. Todo en una transacción.
// Body:
//   Origen: "MOVIMIENTO" (por defecto: Cobranza / Pago / carga manual) o
//           "JSI" (cobro de la Junta de Saneamiento: crea también el cobro)
//   MOVIMIENTO: TipoGastoId (1 egreso, 2 ingreso), TipoGastoGrupoId,
//               RegistroDiarioCajaDetalle
//   JSI: ClienteId
//   Ambos: RegistroDiarioCajaMonto, Motivo
exports.agregarMovimiento = async (req, res) => {
  const errorConStatus = (status, message) =>
    Object.assign(new Error(message), { status });
  const client = await db.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw errorConStatus(400, "Id inválido");
    const esJSI = req.body.Origen === "JSI";
    const monto = Number(req.body.RegistroDiarioCajaMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw errorConStatus(400, "El monto debe ser un número mayor a cero");
    }
    const motivo = typeof req.body.Motivo === "string" ? req.body.Motivo.trim() : "";
    if (!motivo) throw errorConStatus(400, "Indicá el motivo");

    const grupoJSI = await JSICobro.getGrupoIngreso(client);
    let tipo;
    let grupoId;
    let detalle;
    let cliente = null;
    if (esJSI) {
      if (!grupoJSI) {
        throw errorConStatus(400, "La caja J.S.I. no tiene un gasto de ingreso configurado.");
      }
      const clienteId = Number(req.body.ClienteId);
      cliente = Number.isInteger(clienteId)
        ? await JSICobro.getClienteParaDetalle(clienteId, client)
        : null;
      if (!cliente) throw errorConStatus(400, "Elegí el cliente del cobro de JSI");
      tipo = 2;
      grupoId = grupoJSI;
    } else {
      tipo = Number(req.body.TipoGastoId);
      if (tipo !== 1 && tipo !== 2) throw errorConStatus(400, "Elegí ingreso o egreso");
      grupoId = Number(req.body.TipoGastoGrupoId);
      detalle =
        (typeof req.body.RegistroDiarioCajaDetalle === "string" &&
          req.body.RegistroDiarioCajaDetalle.trim()) ||
        "Agregado al cierre";
      const grupo = (
        await client.query(
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
        throw errorConStatus(400, "Los movimientos Western no se agregan desde acá.");
      }
      // Un cobro de JSI suelto (sin su registro en jsicobro) no aparecería en
      // los reportes de JSI
      if (tipo === 2 && grupoId === grupoJSI) {
        throw errorConStatus(400, "Para un cobro de JSI elegí la opción \"Cobro de JSI\".");
      }
    }

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

    // Cobro de JSI: se crea el cobro (caja y fecha del cierre) y su registro
    // de caja lleva el detalle de JuntaSaneamientoTab
    if (esJSI) {
      const cobro = await JSICobro.create(
        {
          CajaId: cierre.CajaId,
          JSICobroFecha: cierre.RegistroDiarioCajaFecha,
          ClienteId: cliente.ClienteId,
          JSICobroMonto: monto,
          JSICobroUsuarioId: req.user.id,
        },
        client
      );
      detalle = JSICobro.detalleRegistro(cliente, cobro.JSICobroId);
    }

    const registro = await RegistroDiarioCaja.crearEnCierreAnterior(client, {
      cierre,
      TipoGastoId: tipo,
      TipoGastoGrupoId: grupoId,
      Monto: monto,
      Detalle: detalle,
      UsuarioId: req.user.id,
    });
    // Aplicar el movimiento (revertir un monto negativo) en las demás cajas
    // del gasto, sin tocar la caja del cajero. JSI usa la misma regla.
    await revertirAperturadaYDemas(client, registro, -monto, true);
    const diferencia = await CierreDiferencia.registrarParaCierre(
      client,
      id,
      `Mov. #${registro.RegistroDiarioCajaId} agregado (${motivo})`
    );
    await RegistroCorreccion.registrar(client, {
      tipo: "ALTA",
      registro: { ...registro, RegistroDiarioCajaMonto: 0, RegistroDiarioCajaDetalle: null },
      montoNuevo: monto,
      detalleNuevo: detalle,
      cierreId: id,
      diferencia,
      motivo: esJSI ? `Cobro de JSI: ${motivo}` : motivo,
      usuarioId: req.user.id,
    });
    await client.query("COMMIT");

    res.status(201).json({
      message: esJSI
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
