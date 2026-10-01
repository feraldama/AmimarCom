const PerfilMenu = require("../models/perfilmenu.model");
const RegistroDiarioCaja = require("../models/registrodiariocaja.model");

// Permisos de los endpoints de reportes:
// - Admin o permiso REPORTES (leer): sin restricción, usa las cajas pedidas.
// - Alguno de los permisos específicos `menus` (leer): el reporte se limita a
//   la caja del usuario (la abierta o la de su última apertura), sin importar
//   qué cajas pida.
// - Ninguno: 403.
const reportePermiso = (...menus) => {
  return async (req, res, next) => {
    try {
      if (req.user.isAdmin === "S") return next();
      const permisos = await PerfilMenu.getPermisosByUsuarioId(req.user.id);
      if (permisos.REPORTES?.leer) return next();
      if (!menus.some((m) => permisos[m]?.leer)) {
        return res
          .status(403)
          .json({ message: "No tienes permiso para generar este reporte" });
      }
      const caja = await RegistroDiarioCaja.getCajaDelUsuario(req.user.id);
      if (!caja) {
        return res.status(403).json({
          message: "No tenés una caja asignada (nunca abriste una caja)",
        });
      }
      // En Express 5 req.query es un getter: se reemplaza en la instancia
      Object.defineProperty(req, "query", {
        value: { ...req.query, cajaIds: String(caja.CajaId), cajaId: undefined },
        writable: true,
        configurable: true,
      });
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
};

module.exports = reportePermiso;
