const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

// Obtener todos los registros con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
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
exports.create = async (req, res) => {
  try {
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
        !esCasoEspecial13 &&
        !esCasoEspecial13Envios &&
        !esCasoEspecialUSDPagos &&
        !esCasoEspecialUSDEnvios
      ) {
        // Casos especiales 13 y USD puro (20/28): no tocar la caja aperturada al eliminar
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

                if (cajaTipoId === 3) {
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

    const registros = await RegistroDiarioCaja.getReportePaseCajas(
      fechaInicio,
      fechaFin,
    );

    // Agrupar por caja y separar ingresos y egresos
    const reportePorCaja = {};

    registros.forEach((registro) => {
      const cajaId = registro.CajaId;
      const cajaKey = `caja_${cajaId}`;

      if (!reportePorCaja[cajaKey]) {
        reportePorCaja[cajaKey] = {
          CajaId: cajaId,
          CajaDescripcion: registro.CajaDescripcion || "",
          ingresos: [],
          egresos: [],
          totalIngresos: 0,
          totalEgresos: 0,
          saldo: 0,
        };
      }

      const monto = Number(registro.RegistroDiarioCajaMonto) || 0;

      // TipoGastoId === 2 es ingreso, TipoGastoId === 1 es egreso
      if (registro.TipoGastoId === 2) {
        reportePorCaja[cajaKey].ingresos.push(registro);
        reportePorCaja[cajaKey].totalIngresos += monto;
      } else if (registro.TipoGastoId === 1) {
        reportePorCaja[cajaKey].egresos.push(registro);
        reportePorCaja[cajaKey].totalEgresos += monto;
      }
    });

    // Calcular saldo para cada caja
    Object.keys(reportePorCaja).forEach((key) => {
      reportePorCaja[key].saldo =
        reportePorCaja[key].totalIngresos - reportePorCaja[key].totalEgresos;
    });

    // Convertir a array
    const reporte = Object.values(reportePorCaja);

    res.json({
      fechaInicio,
      fechaFin,
      data: reporte,
    });
  } catch (error) {
    console.error("Error al generar reporte de pase de cajas:", error);
    res.status(500).json({ message: error.message });
  }
};

// Reporte de movimientos de todas las cajas (CajaTipoId=1)
exports.reporteMovimientosCajas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Faltan los parámetros fechaInicio y fechaFin",
      });
    }

    const registros = await RegistroDiarioCaja.getReporteMovimientosCajas(
      fechaInicio,
      fechaFin,
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
