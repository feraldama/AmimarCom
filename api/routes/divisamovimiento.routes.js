const express = require("express");
const router = express.Router();
const divisaMovimientoController = require("../controllers/divisamovimiento.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para movimientos de divisa
router.get("/reporte-historial", authMiddleware, divisaMovimientoController.reporteHistorial);
router.get("/", authMiddleware, divisaMovimientoController.getAll);
router.get("/search", authMiddleware, divisaMovimientoController.search);
router.get("/:id", authMiddleware, divisaMovimientoController.getById);
router.post("/", authMiddleware, divisaMovimientoController.create);
router.put("/:id", authMiddleware, divisaMovimientoController.update);
router.delete("/:id", authMiddleware, divisaMovimientoController.delete);

module.exports = router;
