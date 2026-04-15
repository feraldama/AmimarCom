const express = require("express");
const router = express.Router();
const nominaController = require("../controllers/nomina.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para nominas
router.get("/", authMiddleware, nominaController.getAll);
router.get("/all", authMiddleware, nominaController.getAllNominasSinPaginacion);
router.get("/search", authMiddleware, nominaController.search);
router.get("/:id", authMiddleware, nominaController.getById);
router.post("/", authMiddleware, nominaController.create);
router.put("/:id", authMiddleware, nominaController.update);
router.delete("/:id", authMiddleware, nominaController.delete);

module.exports = router;
