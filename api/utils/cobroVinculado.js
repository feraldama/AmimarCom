const db = require("../config/db");
const { aplicarEnTurno, motivoEliminacion } = require("./correccionTurno");

// Handlers de edición y eliminación para un cobro que se registra en caja con
// un monto propio (cobros de JSI, pagos de transporte). Corren en una
// transacción con el cobro bloqueado y mantienen su registro de caja en
// sintonía vía aplicarEnTurno: el registro conserva su ID y su turno, y si ese
// turno ya se cerró se recalcula la diferencia de ese cierre sin tocar la caja
// del turno en curso.
//
// config:
//   Modelo        modelo con getById/update/delete que aceptan un client
//   tabla, campoId, campoMonto
//   camposFijos   campos que no pueden cambiar si el cobro ya está en caja
//                 (cambiarían la caja o el grupo de gasto del registro)
//   getRegistros  (cobro, q) => registros de caja del cobro
//   revertir      estrategia de saldos (ver utils/ajusteCajas.js)
//   nombre        "Cobro de JSI", "Pago de transporte"... (mensajes)
const crearHandlersCobroVinculado = ({
  Modelo,
  tabla,
  campoId,
  campoMonto,
  camposFijos,
  getRegistros,
  revertir,
  nombre,
}) => {
  const errorConStatus = (status, message) =>
    Object.assign(new Error(message), { status });
  const noEncontrado = () => errorConStatus(404, `${nombre} no encontrado`);

  // Bloquea el cobro y lo devuelve con sus registros de caja
  const bloquear = async (client, id) => {
    const bloqueado = await client.query(
      `SELECT 1 FROM "${tabla}" WHERE "${campoId}" = $1 FOR UPDATE`,
      [id]
    );
    if (bloqueado.rows.length === 0) throw noEncontrado();
    const cobro = await Modelo.getById(id, client);
    const registros = await getRegistros(cobro, client);
    return { cobro, registros };
  };

  const update = async (req, res) => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { cobro: anterior, registros } = await bloquear(client, req.params.id);
      const [registro] = registros;

      let diferencia = 0;
      if (registro) {
        const cambiado = camposFijos.find(
          (campo) =>
            req.body[campo] !== undefined &&
            req.body[campo] !== null &&
            req.body[campo] !== "" &&
            String(req.body[campo]) !== String(anterior[campo])
        );
        if (cambiado) {
          throw errorConStatus(
            400,
            `No se puede cambiar ${cambiado} de un cobro ya registrado en caja: eliminalo y volvé a cargarlo.`
          );
        }
        if (req.body[campoMonto] !== undefined) {
          const montoNuevo = Number(req.body[campoMonto]);
          if (!Number.isFinite(montoNuevo) || montoNuevo < 0) {
            throw errorConStatus(400, "El monto debe ser un número mayor o igual a cero");
          }
          diferencia = montoNuevo - (Number(anterior[campoMonto]) || 0);
        }
      }

      const actualizado = await Modelo.update(req.params.id, req.body, client);
      if (!actualizado) throw noEncontrado();

      let cierreId = null;
      if (registro && diferencia !== 0) {
        ({ cierreId } = await aplicarEnTurno(client, registro, {
          montoNuevo: (Number(registro.RegistroDiarioCajaMonto) || 0) + diferencia,
          revertir,
          motivo: `Edición del ${nombre.toLowerCase()} #${req.params.id}`,
          usuarioId: req.user.id,
        }));
      }
      await client.query("COMMIT");

      res.json({
        message: cierreId
          ? `${nombre} actualizado. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre.`
          : `${nombre} actualizado exitosamente`,
        data: actualizado,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(error.status || 400).json({ message: error.message });
    } finally {
      client.release();
    }
  };

  const eliminar = async (req, res) => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { registros } = await bloquear(client, req.params.id);
      await Modelo.delete(req.params.id, client);

      const motivo = motivoEliminacion(
        req,
        `Eliminación del ${nombre.toLowerCase()} #${req.params.id}`
      );
      let turnoCerrado = false;
      for (const registro of registros) {
        const { cierreId } = await aplicarEnTurno(client, registro, {
          eliminar: true,
          revertir,
          motivo,
          usuarioId: req.user.id,
        });
        if (cierreId) turnoCerrado = true;
      }
      await client.query("COMMIT");

      res.json({
        message: turnoCerrado
          ? `${nombre} eliminado. Era de un turno ya cerrado: se recalculó la diferencia de ese cierre.`
          : `${nombre} eliminado exitosamente`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (error.message && error.message.includes("a foreign key constraint fails")) {
        return res.status(400).json({
          message: `No se puede eliminar: el ${nombre.toLowerCase()} tiene movimientos asociados.`,
        });
      }
      console.error(`Error al eliminar ${nombre.toLowerCase()}:`, error);
      res.status(500).json({ message: error.message });
    } finally {
      client.release();
    }
  };

  return { update, delete: eliminar };
};

module.exports = { crearHandlersCobroVinculado };
