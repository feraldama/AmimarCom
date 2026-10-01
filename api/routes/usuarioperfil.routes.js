const express = require("express");
const router = express.Router();
const usuarioPerfilController = require("../controllers/usuarioperfil.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.get(
  "/usuario/:usuarioId",
  authMiddleware,
  usuarioPerfilController.getByUsuario
);
router.post("/", authMiddleware, verificarPermiso("USUARIOS", ["crear", "editar"]), usuarioPerfilController.create);
router.delete(
  "/:usuarioId/:perfilId",
  authMiddleware,
  verificarPermiso("USUARIOS", "editar"),
  usuarioPerfilController.delete
);

module.exports = router;
