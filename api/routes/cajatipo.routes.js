const express = require("express");
const router = express.Router();
const cajaTipoController = require("../controllers/cajatipo.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para CajaTipo
router.get("/search", authMiddleware, cajaTipoController.searchCajaTipos);
router.get("/", authMiddleware, cajaTipoController.getAll);
router.get("/:id", authMiddleware, cajaTipoController.getById);
router.post("/", authMiddleware, cajaTipoController.create);
router.put("/:id", authMiddleware, cajaTipoController.update);
router.delete("/:id", authMiddleware, cajaTipoController.delete);

module.exports = router;
