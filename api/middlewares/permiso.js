const PerfilMenu = require("../models/perfilmenu.model");

// Exige el permiso `accion` ("crear" | "editar" | "eliminar" | "leer") sobre
// el menú `menu`. Ambos aceptan una lista: alcanza con cualquier combinación.
// Los administradores pasan siempre. Debe ir después de auth.
const verificarPermiso = (menu, accion) => {
  const menus = Array.isArray(menu) ? menu : [menu];
  const acciones = Array.isArray(accion) ? accion : [accion];
  return async (req, res, next) => {
    try {
      if (req.user?.isAdmin === "S") return next();
      const permisos = await PerfilMenu.getPermisosByUsuarioId(req.user.id);
      if (menus.some((m) => acciones.some((a) => permisos[m]?.[a]))) {
        return next();
      }
      return res
        .status(403)
        .json({ message: "No tienes permiso para esta acción" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
};

module.exports = verificarPermiso;
