const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menu.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.get("/", authMiddleware, menuController.getAll);
router.get("/:id", authMiddleware, menuController.getById);
router.post("/", authMiddleware, verificarPermiso("MENUS", "crear"), menuController.create);
router.put("/:id", authMiddleware, verificarPermiso("MENUS", "editar"), menuController.update);
router.delete("/:id", authMiddleware, verificarPermiso("MENUS", "eliminar"), menuController.delete);

module.exports = router;
