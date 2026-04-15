const WesternEnvio = require("../models/westernenvio.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");
const registroDiarioCajaController = require("./registrodiariocaja.controller");

// Obtener todos los envíos western con paginación
exports.getAll = async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || "WesternEnvioId";
  const sortOrder = req.query.sortOrder || "DESC";
  try {
    const result = await WesternEnvio.getAllPaginated(
      limit,
      offset,
      sortBy,
      sortOrder
    );
    res.json(result);
  } catch (error) {
    console.error("Error al obtener envíos western:", error);
    res.status(500).json({ message: error.message });
  }
};

// Buscar envíos western
exports.search = async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || "WesternEnvioId";
    const sortOrder = req.query.sortOrder || "DESC";

    if (!searchTerm || searchTerm.trim() === "") {
      return res
        .status(400)
        .json({ error: "El término de búsqueda no puede estar vacío" });
    }

    const result = await WesternEnvio.search(
      searchTerm,
      limit,
      offset,
      sortBy,
      sortOrder
    );

    res.json(result);
  } catch (error) {
    console.error("Error en búsqueda de envíos western:", error);
    res.status(500).json({ error: "Error al buscar envíos western" });
  }
};

// Obtener un envío western por ID
exports.getById = async (req, res) => {
  try {
    const envio = await WesternEnvio.getById(req.params.id);
    if (!envio) {
      return res.status(404).json({ message: "Envío western no encontrado" });
    }
    res.json(envio);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear un nuevo envío western
exports.create = async (req, res) => {
  try {
    const envio = await WesternEnvio.create({
      ...req.body,
      UsuarioId: req.user.id, // Asumiendo que tienes el usuario en req.user
    });
    res.status(201).json({
      message: "Envío western creado exitosamente",
      data: envio,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Actualizar un envío western
exports.update = async (req, res) => {
  try {
    const envio = await WesternEnvio.update(req.params.id, req.body);
    if (!envio) {
      return res.status(404).json({ message: "Envío western no encontrado" });
    }
    res.json({
      message: "Envío western actualizado exitosamente",
      data: envio,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un envío western
exports.delete = async (req, res) => {
  try {
    // Obtener el registro de westernenvio antes de eliminarlo
    const envio = await WesternEnvio.getById(req.params.id);
    if (!envio) {
      return res.status(404).json({ message: "Envío western no encontrado" });
    }

    // Buscar el registro correspondiente en registrodiariocaja
    // usando TipoGastoId, TipoGastoGrupoId, detalle y MTCN
    const registroDiarioCaja = await RegistroDiarioCaja.findByWesternEnvio(
      envio.TipoGastoId,
      envio.TipoGastoGrupoId,
      envio.WesternEnvioDetalle,
      envio.WesternEnvioMTCN || 0
    );

    // Si se encuentra el registro en registrodiariocaja, eliminarlo
    // usando las reglas existentes del controlador
    if (registroDiarioCaja) {
      // Crear un objeto request simulado para el controlador de registrodiariocaja
      const mockReq = {
        params: { id: registroDiarioCaja.RegistroDiarioCajaId },
        user: req.user, // Pasar el usuario del request original
      };
      
      let deleteSuccess = false;
      let deleteError = null;
      
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (code === 200) {
              deleteSuccess = true;
            } else {
              deleteError = data;
              console.error(
                "Error al eliminar registro diario de caja:",
                data
              );
            }
            return mockRes;
          },
        }),
        json: (data) => {
          deleteSuccess = true;
          return data;
        },
      };

      try {
        // Llamar al controlador de registrodiariocaja para eliminar
        // Esto aplicará todas las reglas de eliminación existentes
        await registroDiarioCajaController.delete(mockReq, mockRes);
        
        if (!deleteSuccess && deleteError) {
          console.warn(
            "No se pudo eliminar el registro diario de caja asociado, pero se continuará con la eliminación del westernenvio"
          );
        }
      } catch (error) {
        console.error(
          "Error al eliminar registro diario de caja asociado:",
          error
        );
        // Continuar con la eliminación del westernenvio aunque falle la eliminación del registro
      }
    }

    // Eliminar el registro de westernenvio
    const success = await WesternEnvio.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Envío western no encontrado" });
    }
    res.json({ message: "Envío western eliminado exitosamente" });
  } catch (error) {
    if (
      error &&
      error.message &&
      error.message.includes("a foreign key constraint fails")
    ) {
      return res.status(400).json({
        message:
          "No se puede eliminar el envío western porque tiene movimientos asociados.",
      });
    }
    console.error("Error al eliminar envío western:", error);
    res.status(500).json({ message: error.message });
  }
};
