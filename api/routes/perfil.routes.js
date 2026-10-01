const express = require("express");
const router = express.Router();
const perfilController = require("../controllers/perfil.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.get("/", authMiddleware, perfilController.getAll);
router.get("/:id", authMiddleware, perfilController.getById);
router.post("/", authMiddleware, verificarPermiso("PERFILES", "crear"), perfilController.create);
router.put("/:id", authMiddleware, verificarPermiso("PERFILES", "editar"), perfilController.update);
router.delete("/:id", authMiddleware, verificarPermiso("PERFILES", "eliminar"), perfilController.delete);

module.exports = router;
