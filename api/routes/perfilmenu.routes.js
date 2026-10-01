const express = require("express");
const router = express.Router();
const perfilMenuController = require("../controllers/perfilmenu.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.get(
  "/perfil/:perfilId",
  authMiddleware,
  perfilMenuController.getByPerfil
);
router.get(
  "/usuario/:usuarioId",
  authMiddleware,
  perfilMenuController.getPermisosByUsuarioId
);
router.post("/", authMiddleware, verificarPermiso("PERFILES", ["crear", "editar"]), perfilMenuController.create);
router.put("/:perfilId/:menuId", authMiddleware, verificarPermiso("PERFILES", "editar"), perfilMenuController.update);
router.delete(
  "/:perfilId/:menuId",
  authMiddleware,
  verificarPermiso("PERFILES", "editar"),
  perfilMenuController.delete
);

module.exports = router;
