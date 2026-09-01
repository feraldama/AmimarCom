const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

// Obtener todos los registros con paginación
// Lee los parámetros de filtro de la query (compartidos por getAll y search)
const parseFiltros = (query) => ({
  fechaDesde: query.fechaDesde || undefined,
  fechaHasta: query.fechaHasta || undefined,
  cajaId: query.cajaId || undefined,
  tipoGastoId: query.tipoGastoId || undefined,
  tipoGastoGrupoId: query.tipoGastoGrupoId || undefined,
});

exports.getAll = async (req, res) => {
  const sortBy = req.query.sortBy || "RegistroDiarioCajaFecha";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await RegistroDiarioCaja.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query),
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener registros:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar registros
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "RegistroDiarioCajaFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await RegistroDiarioCaja.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder,
      parseFiltros(req.query),
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de registros:", error);
    res.status(500).json({ error: "Error al buscar registros" });
  }
};

// Obtener un registro por ID
exports.getById = async (req, res) => {
  try {
    const registro = await RegistroDiarioCaja.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }
    res.json(registro);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo registro
// Indica si el grupo de gasto corresponde a un pase entre cajas
// (descripción "PASE ..."). Esos movimientos sólo pueden crearse por el
// endpoint /pase, que genera las dos patas en una transacción.
const esGrupoPase = async (tipoGastoId, tipoGastoGrupoId) => {
  if (!tipoGastoId || !tipoGastoGrupoId) return false;
  const result = await db.query(
    `SELECT 1 FROM "tipogastogrupo"
     WHERE "TipoGastoId" = $1 AND "TipoGastoGrupoId" = $2
       AND TRIM("TipoGastoGrupoDescripcion") ILIKE 'PASE %'`,
    [tipoGastoId, tipoGastoGrupoId]
  );
  return result.rows.length > 0;
};

exports.create = async (req, res) => {
  try {
    // Los grupos "PASE ..." quedan reservados al endpoint /pase: crear una
    // sola pata por acá deja el pase desbalanceado (sobrante/faltante en el
    // cierre de la caja contraparte).
    if (await esGrupoPase(req.body.TipoGastoId, req.body.TipoGastoGrupoId)) {
      return res.status(400).json({
        message:
          "Los pases entre cajas deben registrarse desde la pestaña Pase de Cajas, que genera el egreso y el ingreso juntos.",
      });
    }

    const registro = await RegistroDiarioCaja.create({
      ...req.body,
      UsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Registro creado exitosamente",
      data: registro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Crear un pase entre cajas (egreso en origen + ingreso en destino, atómico)
exports.createPase = async (req, res) => {
  try {
    const {
      CajaOrigenId,
      CajaDestinoId,
      RegistroDiarioCajaFecha,
      RegistroDiarioCajaDetalle,
      RegistroDiarioCajaMonto,
    } = req.body;

    if (!CajaOrigenId || !CajaDestinoId) {
      return res
        .status(400)
        .json({ message: "Caja origen y caja destino son requeridas" });
    }
    if (Number(CajaOrigenId) === Number(CajaDestinoId)) {
      return res
        .status(400)
        .json({ message: "La caja origen y la caja destino no pueden ser la misma" });
    }
    const monto = Number(RegistroDiarioCajaMonto);
    if (!monto || isNaN(monto) || monto <= 0) {
      return res
        .status(400)
        .json({ message: "El monto debe ser un número mayor a cero" });
    }

    const resultado = await RegistroDiarioCaja.createPase({
      CajaOrigenId,
      CajaDestinoId,
      RegistroDiarioCajaFecha,
      RegistroDiarioCajaDetalle,
      RegistroDiarioCajaMonto: monto,
      UsuarioId: req.user.id,
    });

    res.status(201).json({
      message: "Pase registrado exitosamente",
      data: resultado,
    });
  } catch (error) {
    console.error("Error al registrar pase entre cajas:", error);
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un registro
exports.update = async (req, res) => {
  try {
    const registro = await RegistroDiarioCaja.update(req.params.id, req.body);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }
    res.json({
      message: "Registro actualizado exitosamente",
      data: registro,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un registro
exports.delete = async (req, res) => {
  try {
    // Obtener el registro antes de eliminarlo para tener los datos necesarios
    const registro = await RegistroDiarioCaja.getById(req.params.id);
    if (!registro) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    // Los pases entre cajas se eliminan por par: la pata pedida y su
    // contrapartida (si existe), revirtiendo ambos saldos en una transacción.
    // Este camino no pasa por la lógica de cajagasto de más abajo porque un
    // pase sólo afecta a las dos cajas involucradas.
    if (await esGrupoPase(registro.TipoGastoId, registro.TipoGastoGrupoId)) {
      const resultado = await RegistroDiarioCaja.deletePase(registro);
      return res.json({
        message: resultado.contrapartidaId
          ? "Pase eliminado exitosamente (egreso e ingreso)"
          : "Registro de pase eliminado exitosamente (no se encontró contrapartida)",
        data: resultado,
      });
    }

    const {
      CajaId,
      TipoGastoId,
      TipoGastoGrupoId,
      RegistroDiarioCajaMonto,
      RegistroDiarioCajaCambio,
      RegistroDiarioCajaFecha,
      UsuarioId,
      RegistroDiarioCajaDetalle,
    } = registro;

    // Verificar si es un registro de PAGO ADMIN
    // Pago admin usa TipoGastoId=1, TipoGastoGrupoId=21 para egreso
    // y TipoGastoId=2, TipoGastoGrupoId=26 para ingreso
    const esPagoAdmin =
      (TipoGastoId === 1 && TipoGastoGrupoId === 21) ||
      (TipoGastoId === 2 && TipoGastoGrupoId === 26) ||
      (RegistroDiarioCajaDetalle &&
        RegistroDiarioCajaDetalle.includes("PAGO ADMIN"));

    // Determinar si es ingreso (TipoGastoId === 2) o egreso (TipoGastoId === 1)
    // Al eliminar, invertimos la operación:
    // - Si era egreso (restó), ahora sumamos
    // - Si era ingreso (sumó), ahora restamos
    const esIngreso = TipoGastoId === 2;
    const monto = Number(RegistroDiarioCajaMonto) || 0;
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

    // Conjunto de IDs de cajas a actualizar
    const cajasIdsParaActualizar = new Set();

    // Agregar la caja del registro
    if (CajaId) {
      cajasIdsParaActualizar.add(Number(CajaId));
    }

    // Obtener todas las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId en cajagasto
    if (TipoGastoId && TipoGastoGrupoId) {
      const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
        TipoGastoId,
        TipoGastoGrupoId,
      );
      cajasConGasto.forEach((cajaGasto) => {
        if (cajaGasto.CajaId) {
          cajasIdsParaActualizar.add(Number(cajaGasto.CajaId));
        }
      });
    }

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

    // Si es un registro de PAGO ADMIN, no actualizar las cajas aquí
    // porque ya se actualizan en pagoadmin.controller.js al eliminar el pago admin
    if (!esPagoAdmin) {
      // Separar la caja del registro de las demás cajas
      const cajaIdRegistro = CajaId ? Number(CajaId) : null;
      const cajasIdsConGasto = new Set();

      // Obtener todas las cajas que tienen el mismo TipoGastoId y TipoGastoGrupoId en cajagasto
      if (TipoGastoId && TipoGastoGrupoId) {
        const cajasConGasto = await CajaGasto.getByTipoGastoAndGrupo(
          TipoGastoId,
          TipoGastoGrupoId,
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
        !esCasoEspecial13Envios &&
        !esCasoEspecialUSDPagos &&
        !esCasoEspecialUSDEnvios
      ) {
        // Casos especiales USD puro (20/28): no tocar la caja aperturada al eliminar.
        // El grupo 13 (EXTRACCIONES) SÍ se revierte aquí: al crearse desde la
        // pestaña Pago se debita la caja aperturada, por lo que al eliminar hay
        // que devolverle el monto (antes se salteaba y la plata no volvía).
        const cajaResult = await db.query(
          'SELECT "CajaMonto", "CajaTipoId" FROM "caja" WHERE "CajaId" = $1',
          [cajaIdRegistro]
        );
        const cajaActual = cajaResult.rows.length > 0 ? cajaResult.rows[0] : null;

        if (cajaActual) {
          const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
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

          const nuevoMonto = cajaMontoActual + montoAplicar;

          await db.query(
            'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
            [nuevoMonto, cajaIdRegistro]
          );
        }
      }

      // Actualizar las demás cajas
      const cajasParaActualizar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdRegistro,
      );

      if (cajasParaActualizar.length > 0) {
        const actualizaciones = cajasParaActualizar.map(
          async (cajaIdParaActualizar) => {
            const cajaResult2 = await db.query(
              'SELECT "CajaMonto", "CajaTipoId" FROM "caja" WHERE "CajaId" = $1',
              [cajaIdParaActualizar]
            );
            const cajaActual = cajaResult2.rows.length > 0 ? cajaResult2.rows[0] : null;

            if (cajaActual) {
              const cajaMontoActual = Number(cajaActual.CajaMonto) || 0;
              const cajaTipoId = Number(cajaActual.CajaTipoId);
              let nuevoMonto;

              if (esCasoEspecialUSDCotPagos || esCasoEspecial13) {
                // Casos especiales de PAGOS: revertir la suma de Monto/CambioDolar (restar)
                const montoConvertido = monto / cambioNumero;
                let montoAplicar = -montoConvertido; // Revertir: restar

                if (cajaTipoId === 3) {
                  // Operación opuesta para CajaTipoId=3
                  montoAplicar = montoConvertido;
                }

                nuevoMonto = cajaMontoActual + montoAplicar;
              } else if (esCasoEspecialUSDCotEnvios || esCasoEspecial13Envios) {
                // Casos especiales de ENVÍOS: revertir la resta de Monto/CambioDolar (sumar)
                const montoConvertido = monto / cambioNumero;
                let montoAplicar = montoConvertido; // Revertir: sumar (opuesto a pagos)

                if (cajaTipoId === 3) {
                  // Operación opuesta para CajaTipoId=3
                  montoAplicar = -montoConvertido;
                }

                nuevoMonto = cajaMontoActual + montoAplicar;
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

                nuevoMonto = cajaMontoActual + montoAplicar;
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

                nuevoMonto = cajaMontoActual + montoAplicar;
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

                nuevoMonto = cajaMontoActual + montoAplicar;
              }

              await db.query(
                'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
                [nuevoMonto, cajaIdParaActualizar]
              );
            }
          },
        );

        await Promise.all(actualizaciones);
      }
    } // Fin del if (!esPagoAdmin)

    // Eliminar el registro
    const success = await RegistroDiarioCaja.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Registro no encontrado" });
    }

    res.json({ message: "Registro eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el registro porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar registro:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.aperturaCierreCaja = async (req, res) => {
  try {
    const {
      apertura,
      CajaId,
      Monto,
      RegistroDiarioCajaPendiente1,
      RegistroDiarioCajaPendiente2,
      RegistroDiarioCajaPendiente3,
      RegistroDiarioCajaPendiente4,
    } = req.body;
    const UsuarioId = req.user?.id || req.body.UsuarioId;
    if (
      !CajaId ||
      typeof apertura === "undefined" ||
      typeof Monto === "undefined" ||
      !UsuarioId
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan datos requeridos" });
    }
    let Sigue = "N";
    let error = "";
    // Buscar última apertura y cierre
    const aperturaReg = await RegistroDiarioCaja.getUltimaApertura(CajaId);
    const cierreReg = await RegistroDiarioCaja.getUltimoCierre(CajaId);
    const RegistroDiarioCajaIdApertura = aperturaReg
      ? aperturaReg.RegistroDiarioCajaId
      : 0;
    const RegistroDiarioCajaIdCierre = cierreReg
      ? cierreReg.RegistroDiarioCajaId
      : 0;
    if (apertura == 0) {
      if (RegistroDiarioCajaIdApertura === 0) {
        Sigue = "S";
      } else if (RegistroDiarioCajaIdCierre > RegistroDiarioCajaIdApertura) {
        Sigue = "S";
      } else {
        Sigue = "N";
        error = "CAJA ABIERTA - DEBE REALIZAR EL CIERRE";
      }
      // El usuario no puede aperturar si ya tiene OTRA caja abierta
      if (Sigue === "S") {
        const estadoUsuario =
          await RegistroDiarioCaja.getEstadoAperturaPorUsuario(UsuarioId);
        if (
          estadoUsuario.cajaId &&
          estadoUsuario.aperturaId > estadoUsuario.cierreId
        ) {
          Sigue = "N";
          error = `USTED YA TIENE ABIERTA LA CAJA ${estadoUsuario.cajaId} - DEBE REALIZAR EL CIERRE`;
        }
      }
    } else {
      if (RegistroDiarioCajaIdCierre < RegistroDiarioCajaIdApertura) {
        Sigue = "S";
      } else {
        Sigue = "N";
        error = "CAJA CERRADA - DEBE REALIZAR LA APERTURA";
      }
    }
    if (Sigue === "N") {
      return res.status(400).json({ success: false, message: error });
    }
    // Obtener descripción de caja
    const cajaResult = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [CajaId]
    );
    const caja = cajaResult.rows[0];
    const CajaDescripcion = caja ? caja.CajaDescripcion : "";
    // APERTURA: el monto de apertura es el CajaMonto de la caja (valor fijo)
    if (apertura == 0) {
      const montoApertura = Number(caja?.CajaMonto) || 0;
      // Crear registro de apertura
      await RegistroDiarioCaja.create({
        CajaId,
        RegistroDiarioCajaFecha: new Date(),
        TipoGastoId: 2,
        TipoGastoGrupoId: 2,
        RegistroDiarioCajaDetalle: "APERTURA " + CajaDescripcion,
        RegistroDiarioCajaMonto: montoApertura,
        UsuarioId,
      });
      // CajaMonto en la tabla Caja no se modifica (queda fijo)
      return res.json({
        success: true,
        message: "Apertura realizada correctamente",
      });
    } else {
      // CIERRE: CajaMonto en la tabla Caja no se modifica (queda fijo)
      // Crear registro de cierre (con pendientes 1-4)
      await RegistroDiarioCaja.create({
        CajaId,
        RegistroDiarioCajaFecha: new Date(),
        TipoGastoId: 1,
        TipoGastoGrupoId: 2,
        RegistroDiarioCajaDetalle: "CIERRE " + CajaDescripcion,
        RegistroDiarioCajaMonto: Monto,
        UsuarioId,
        RegistroDiarioCajaPendiente1: Number(RegistroDiarioCajaPendiente1) || 0,
        RegistroDiarioCajaPendiente2: Number(RegistroDiarioCajaPendiente2) || 0,
        RegistroDiarioCajaPendiente3: Number(RegistroDiarioCajaPendiente3) || 0,
        RegistroDiarioCajaPendiente4: Number(RegistroDiarioCajaPendiente4) || 0,
      });
      return res.json({
        success: true,
        message: "Cierre realizado correctamente",
      });
    }
  } catch (error) {
    console.error("Error en apertura/cierre de caja:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// Nuevo endpoint para saber si el usuario tiene caja aperturada
exports.estadoAperturaPorUsuario = async (req, res) => {
  try {
    const usuarioId = req.query.usuarioId;
    if (!usuarioId) {
      return res.status(400).json({ message: "Falta el parámetro usuarioId" });
    }
    const estado =
      await RegistroDiarioCaja.getEstadoAperturaPorUsuario(usuarioId);
    res.json(estado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reporte de pase de cajas
exports.reportePaseCajas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    const { cajas, movimientos } = await RegistroDiarioCaja.getReportePaseCajas(
      fechaInicio,
      fechaFin,
    );

    // Todas las cajas tipo 1 se listan, tengan o no pases en el período
    const data = cajas.map((caja) => ({
      CajaId: caja.CajaId,
      CajaDescripcion: (caja.CajaDescripcion || "").trim(),
      pases: [],
    }));
    const porCajaId = Object.fromEntries(data.map((c) => [c.CajaId, c]));

    let totalEgresos = 0;
    let totalIngresos = 0;

    movimientos.forEach((m) => {
      const caja = porCajaId[m.CajaId];
      if (!caja) return; // pase registrado en una caja que no es tipo 1

      const monto = Number(m.RegistroDiarioCajaMonto) || 0;
      // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
      const esIngreso = m.TipoGastoId === 2;
      if (esIngreso) totalIngresos += monto;
      else totalEgresos += monto;

      caja.pases.push({
        RegistroDiarioCajaId: m.RegistroDiarioCajaId,
        Tipo: esIngreso ? "INGRESO" : "EGRESO",
        GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
        Fecha: m.RegistroDiarioCajaFecha,
        Monto: monto,
        UsuarioId: m.UsuarioId,
        UsuarioNombre: (m.UsuarioNombre || "").trim(),
        Detalle: m.RegistroDiarioCajaDetalle || "",
      });
    });

    res.json({
      fechaInicio,
      fechaFin,
      data,
      totalEgresos,
      totalIngresos,
      diferencia: totalIngresos - totalEgresos,
    });
  } catch (error) {
    console.error("Error al generar reporte de pase de cajas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte de movimientos de todas las cajas (CajaTipoId=1)
exports.reporteMovimientosCajas = async (req, res) => {
  try {
    // cajaIds: lista separada por comas (ej: "4,5"); se mantiene cajaId
    // (individual) por compatibilidad. tipo: 1=egresos, 2=ingresos.
    const { fechaInicio, fechaFin, cajaId, cajaIds, tipo } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    let listaCajas = [];
    if (cajaIds) {
      listaCajas = String(cajaIds)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);
    } else if (cajaId) {
      listaCajas = [Number(cajaId)];
    }

    const tipoGastoId =
      tipo === "1" || tipo === "2" ? Number(tipo) : undefined;

    const registros = await RegistroDiarioCaja.getReporteMovimientosCajas(
      fechaInicio,
      fechaFin,
      listaCajas,
      tipoGastoId,
    );

    res.json({
      fechaInicio,
      fechaFin,
      data: registros,
    });
  } catch (error) {
    console.error("Error al generar reporte de movimientos de cajas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Cierre Diario de Caja
exports.reporteCierreDiario = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }
    const data = await RegistroDiarioCaja.getCierreDiario(fechaInicio, fechaFin);
    res.json({ fechaInicio, fechaFin, data });
  } catch (error) {
    console.error("Error al generar reporte cierre diario:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Ingresos/Egresos Resumen (totales por grupo de tipo de gasto)
exports.reporteIngresosEgresos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    const grupos = await RegistroDiarioCaja.getReporteIngresosEgresos(
      fechaInicio,
      fechaFin,
    );

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = grupos.filter((g) => g.TipoGastoId === 1);
    const ingresos = grupos.filter((g) => g.TipoGastoId === 2);
    const totalEgresos = egresos.reduce((s, g) => s + Number(g.Total), 0);
    const totalIngresos = ingresos.reduce((s, g) => s + Number(g.Total), 0);

    res.json({
      fechaInicio,
      fechaFin,
      egresos,
      ingresos,
      totalEgresos,
      totalIngresos,
      saldo: totalIngresos - totalEgresos,
    });
  } catch (error) {
    console.error("Error al generar reporte ingresos/egresos:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Western Ingresos/Egresos. moneda=gs (grupos "1 WESTERN ...")
// o moneda=usd (grupos "2 WESTERN ...").
exports.reporteWestern = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, moneda } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    // Grupos por moneda: "1 WESTERN ..." son pagos/envíos en Gs.;
    // "2 WESTERN ..." son USD con cotización (monto en Gs. + cambio) y
    // "3 WESTERN ..." son USD puro (el monto ya está en dólares, sin cambio),
    // por eso el reporte USD incluye ambos prefijos.
    const prefijos =
      moneda === "usd" ? ["2 WESTERN", "3 WESTERN"] : ["1 WESTERN"];
    const registros = await RegistroDiarioCaja.getReporteWestern(
      fechaInicio,
      fechaFin,
      prefijos,
    );

    const mapear = (m) => ({
      RegistroDiarioCajaId: m.RegistroDiarioCajaId,
      GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
      Detalle: m.RegistroDiarioCajaDetalle || "",
      Fecha: m.RegistroDiarioCajaFecha,
      Monto: Number(m.RegistroDiarioCajaMonto) || 0,
      Cambio: Number(m.RegistroDiarioCajaCambio) || 0,
      MTCN: m.RegistroDiarioCajaMTCN,
      CajaDescripcion: (m.CajaDescripcion || "").trim(),
      UsuarioId: m.UsuarioId,
      UsuarioNombre: (m.UsuarioNombre || "").trim(),
      // En los grupos "3 WESTERN ..." el monto ya está en USD (no en Gs.)
      EsUsdPuro: (m.TipoGastoGrupoDescripcion || "")
        .trim()
        .toUpperCase()
        .startsWith("3 WESTERN"),
    });

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = registros.filter((m) => m.TipoGastoId === 1).map(mapear);
    const ingresos = registros.filter((m) => m.TipoGastoId === 2).map(mapear);
    // Totales en Gs.: los montos USD puro no se suman acá porque están en
    // otra moneda (el reporte USD calcula sus totales en dólares aparte).
    const totalEgresos = egresos
      .filter((m) => !m.EsUsdPuro)
      .reduce((s, m) => s + m.Monto, 0);
    const totalIngresos = ingresos
      .filter((m) => !m.EsUsdPuro)
      .reduce((s, m) => s + m.Monto, 0);

    res.json({
      fechaInicio,
      fechaFin,
      moneda: moneda === "usd" ? "usd" : "gs",
      egresos,
      ingresos,
      totalEgresos,
      totalIngresos,
      diferencia: totalEgresos - totalIngresos,
    });
  } catch (error) {
    console.error("Error al generar reporte western:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: Anticipos (movimientos de un grupo de gasto por descripción,
// con egresos/ingresos, cotización y equivalente USD)
exports.reporteAnticipos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, grupo } = req.query;
    if (!fechaInicio || !fechaFin || !grupo) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio, fechaFin y grupo",
      });
    }

    const registros = await RegistroDiarioCaja.getReporteGrupo(
      fechaInicio,
      fechaFin,
      grupo,
    );

    let totalEgresos = 0;
    let totalIngresos = 0;
    let totalEgresosUsd = 0;
    let totalIngresosUsd = 0;
    let sumaCotizacion = 0;
    let cantConCotizacion = 0;

    const movimientos = registros.map((m) => {
      const monto = Number(m.RegistroDiarioCajaMonto) || 0;
      const cambio = Number(m.RegistroDiarioCajaCambio) || 0;
      const montoUsd = cambio > 0 ? monto / cambio : 0;
      // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
      const esIngreso = m.TipoGastoId === 2;
      if (esIngreso) {
        totalIngresos += monto;
        totalIngresosUsd += montoUsd;
      } else {
        totalEgresos += monto;
        totalEgresosUsd += montoUsd;
      }
      if (cambio > 0) {
        sumaCotizacion += cambio;
        cantConCotizacion += 1;
      }
      return {
        RegistroDiarioCajaId: m.RegistroDiarioCajaId,
        Tipo: esIngreso ? "INGRESO" : "EGRESO",
        GrupoDescripcion: (m.TipoGastoGrupoDescripcion || "").trim(),
        Detalle: m.RegistroDiarioCajaDetalle || "",
        Fecha: m.RegistroDiarioCajaFecha,
        Monto: monto,
        Cambio: cambio,
        MontoUsd: montoUsd,
        CajaDescripcion: (m.CajaDescripcion || "").trim(),
        UsuarioId: m.UsuarioId,
        UsuarioNombre: (m.UsuarioNombre || "").trim(),
      };
    });

    res.json({
      fechaInicio,
      fechaFin,
      grupo,
      movimientos,
      totalEgresos,
      totalIngresos,
      totalEgresosUsd,
      totalIngresosUsd,
      promedioCotizacion:
        cantConCotizacion > 0 ? sumaCotizacion / cantConCotizacion : 0,
    });
  } catch (error) {
    console.error("Error al generar reporte de anticipos:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte: El Comercio (resumen de los grupos asociados a WEPA / WEPA USD)
exports.reporteElComercio = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ message: "Faltan los parámetros fechaInicio y fechaFin" });
    }

    const grupos = await RegistroDiarioCaja.getReporteElComercio(
      fechaInicio,
      fechaFin,
    );

    // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
    const egresos = grupos.filter((g) => g.TipoGastoId === 1);
    const ingresos = grupos.filter((g) => g.TipoGastoId === 2);
    const sumar = (rows, campo) => rows.reduce((s, g) => s + Number(g[campo]), 0);

    res.json({
      fechaInicio,
      fechaFin,
      egresos,
      ingresos,
      totalEgresos: sumar(egresos, "Total"),
      totalIngresos: sumar(ingresos, "Total"),
      totalEgresosUsd: sumar(egresos, "TotalUsd"),
      totalIngresosUsd: sumar(ingresos, "TotalUsd"),
    });
  } catch (error) {
    console.error("Error al generar reporte El Comercio:", error);
    res.status(500).json({ message: error.message });
  }
};
