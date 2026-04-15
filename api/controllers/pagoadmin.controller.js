const PagoAdmin = require("../models/pagoadmin.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const CajaGasto = require("../models/cajagasto.model");
const db = require("../config/db");

// Obtener todos los pagos admin con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "PagoAdminFecha";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await PagoAdmin.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener pagos admin:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar pagos admin
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "PagoAdminFecha";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await PagoAdmin.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de pagos admin:", error);
    res.status(500).json({ error: "Error al buscar pagos admin" });
  }
};

// Obtener un pago admin por ID
exports.getById = async (req, res) => {
  try {
    const pagoAdmin = await PagoAdmin.getById(req.params.id);
    if (!pagoAdmin) {
      return res.status(404).json({ message: "Pago admin no encontrado" });
    }
    res.json(pagoAdmin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo pago admin
exports.create = async (req, res) => {
  try {
    const { CajaOrigenId, CajaId, PagoAdminFecha, PagoAdminDetalle, PagoAdminMonto } = req.body;
    const UsuarioId = req.user.id;

    // Validar que se proporcionen los datos necesarios
    if (!CajaOrigenId || !CajaId || !PagoAdminMonto) {
      return res.status(400).json({ 
        message: "Faltan datos requeridos: CajaOrigenId, CajaId y PagoAdminMonto" 
      });
    }

    // Obtener descripciones de las cajas
    const cajaOrigenResult = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [CajaOrigenId]
    );
    const cajaOrigen = cajaOrigenResult.rows[0];

    const cajaDestinoResult = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [CajaId]
    );
    const cajaDestino = cajaDestinoResult.rows[0];

    if (!cajaOrigen || !cajaDestino) {
      return res.status(404).json({ 
        message: "Una o ambas cajas no fueron encontradas" 
      });
    }

    const CajaOrigenDescripcion = cajaOrigen.CajaDescripcion || "";
    const CajaDestinoDescripcion = cajaDestino.CajaDescripcion || "";
    const monto = Number(PagoAdminMonto) || 0;
    const fecha = PagoAdminFecha || new Date();

    // Crear el pago admin
    const pagoAdmin = await PagoAdmin.create({
      CajaOrigenId,
      CajaId,
      PagoAdminFecha: fecha,
      PagoAdminDetalle,
      PagoAdminMonto: monto,
      UsuarioId,
    });

    // Crear registro de egreso para la caja origen (TipoGastoId=1, TipoGastoGrupoId=21)
    await RegistroDiarioCaja.create({
      CajaId: CajaOrigenId,
      RegistroDiarioCajaFecha: fecha,
      TipoGastoId: 1,
      TipoGastoGrupoId: 21,
      RegistroDiarioCajaDetalle: `PAGO ADMIN PagoAdminId:${pagoAdmin.PagoAdminId} - ${PagoAdminDetalle || "Sin detalle"} - A: ${CajaDestinoDescripcion}`,
      RegistroDiarioCajaMonto: monto,
      UsuarioId,
      RegistroDiarioCajaCambio: 0,
      RegistroDiarioCajaPendiente1: 0,
      RegistroDiarioCajaPendiente2: 0,
      RegistroDiarioCajaPendiente3: 0,
      RegistroDiarioCajaPendiente4: 0,
      RegistroDiarioCajaMTCN: 0,
      RegistroDiarioCajaCargoEnvio: 0,
    });

    // Crear registro de ingreso para la caja destino (TipoGastoId=2, TipoGastoGrupoId=26)
    await RegistroDiarioCaja.create({
      CajaId: CajaId,
      RegistroDiarioCajaFecha: fecha,
      TipoGastoId: 2,
      TipoGastoGrupoId: 26,
      RegistroDiarioCajaDetalle: `PAGO ADMIN PagoAdminId:${pagoAdmin.PagoAdminId} - ${PagoAdminDetalle || "Sin detalle"} - DE: ${CajaOrigenDescripcion}`,
      RegistroDiarioCajaMonto: monto,
      UsuarioId,
      RegistroDiarioCajaCambio: 0,
      RegistroDiarioCajaPendiente1: 0,
      RegistroDiarioCajaPendiente2: 0,
      RegistroDiarioCajaPendiente3: 0,
      RegistroDiarioCajaPendiente4: 0,
      RegistroDiarioCajaMTCN: 0,
      RegistroDiarioCajaCargoEnvio: 0,
    });

    // Actualizar monto de la caja origen
    const cajaOrigenMontoActual = Number(cajaOrigen.CajaMonto) || 0;
    const cajaOrigenTipoId = Number(cajaOrigen.CajaTipoId);
    
    // Si CajaTipoId === 1, CajaTipoId === 3 o CajaTipoId === 9, restar (comportamiento normal)
    // Si CajaTipoId es otro valor, hacer operación opuesta (sumar en lugar de restar)
    const nuevoMontoOrigen = (cajaOrigenTipoId === 1 || cajaOrigenTipoId === 3 || cajaOrigenTipoId === 9)
      ? cajaOrigenMontoActual - monto  // Restar (comportamiento normal)
      : cajaOrigenMontoActual + monto; // Sumar (operación opuesta)
    
    await db.query(
      'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
      [nuevoMontoOrigen, CajaOrigenId]
    );

    // Actualizar monto de la caja destino (sumar - es ingreso)
    const cajaDestinoMontoActual = Number(cajaDestino.CajaMonto) || 0;
    await db.query(
      'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
      [cajaDestinoMontoActual + monto, CajaId]
    );

    res.status(201).json({
      message: "Pago admin creado exitosamente",
      data: pagoAdmin,
    });
  } catch (error) {
    console.error("Error al crear pago admin:", error);
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un pago admin
exports.update = async (req, res) => {
  try {
    const pagoAdmin = await PagoAdmin.update(req.params.id, req.body);
    if (!pagoAdmin) {
      return res.status(404).json({ message: "Pago admin no encontrado" });
    }
    res.json({
      message: "Pago admin actualizado exitosamente",
      data: pagoAdmin,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un pago admin
exports.delete = async (req, res) => {
  try {
    // Obtener el pago admin antes de eliminarlo para tener los datos necesarios
    const pagoAdmin = await PagoAdmin.getById(req.params.id);
    if (!pagoAdmin) {
      return res.status(404).json({ message: "Pago admin no encontrado" });
    }

    const { PagoAdminId } = pagoAdmin;

    // Buscar los registros relacionados en registrodiariocaja usando PagoAdminId
    const registrosRelacionadosResult = await db.query(
      `SELECT "RegistroDiarioCajaId", "RegistroDiarioCajaMonto"
       FROM "registrodiariocaja"
       WHERE "RegistroDiarioCajaDetalle" LIKE $1`,
      [`%PagoAdminId:${PagoAdminId}%`]
    );
    const registrosRelacionados = registrosRelacionadosResult.rows;

    // Obtener las cajas para revertir los cambios directos
    const cajaOrigenDelResult = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [pagoAdmin.CajaOrigenId]
    );
    const cajaOrigen = cajaOrigenDelResult.rows[0];

    const cajaDestinoDelResult = await db.query(
      'SELECT * FROM "caja" WHERE "CajaId" = $1',
      [pagoAdmin.CajaId]
    );
    const cajaDestino = cajaDestinoDelResult.rows[0];

    const monto = Number(pagoAdmin.PagoAdminMonto) || 0;

    // Eliminar el pago admin primero
    const success = await PagoAdmin.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Pago admin no encontrado" });
    }

    // Revertir el cambio directo en la caja origen
    if (cajaOrigen) {
      const cajaOrigenMontoActual = Number(cajaOrigen.CajaMonto) || 0;
      const cajaOrigenTipoId = Number(cajaOrigen.CajaTipoId);
      
      let nuevoMontoOrigen;
      if (cajaOrigenTipoId === 1 || cajaOrigenTipoId === 3 || cajaOrigenTipoId === 9) {
        // Si CajaTipoId === 1, CajaTipoId === 3 o CajaTipoId === 9: se había restado, al eliminar se suma (revertir normal)
        nuevoMontoOrigen = cajaOrigenMontoActual + monto;
      } else {
        // Si CajaTipoId es otro valor: se había sumado, al eliminar se resta (revertir normal)
        nuevoMontoOrigen = cajaOrigenMontoActual - monto;
      }
      
      await db.query(
        'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
        [nuevoMontoOrigen, pagoAdmin.CajaOrigenId]
      );
    }

    // Revertir el cambio directo en la caja destino (siempre se había sumado, ahora restar)
    if (cajaDestino) {
      const cajaDestinoMontoActual = Number(cajaDestino.CajaMonto) || 0;
      await db.query(
        'UPDATE "caja" SET "CajaMonto" = $1 WHERE "CajaId" = $2',
        [cajaDestinoMontoActual - monto, pagoAdmin.CajaId]
      );
    }

    // Si hay registros relacionados, eliminarlos directamente sin actualizar cajas
    // Las cajas ya se actualizaron directamente arriba (caja origen y destino)
    if (registrosRelacionados && registrosRelacionados.length > 0) {
      for (const registro of registrosRelacionados) {
        // Eliminar el registro de registrodiariocaja directamente sin pasar por el controlador
        // para evitar que se actualicen las cajas dos veces
        await RegistroDiarioCaja.delete(registro.RegistroDiarioCajaId);
      }
    }

    res.json({ message: "Pago admin eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el pago admin porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar pago admin:", error);
    res.status(500).json({ message: error.message });
  }
};
