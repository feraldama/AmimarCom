const express = require("express");
const router = express.Router();
const pagoTransController = require("../controllers/pagotrans.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para pagos de transporte
router.get("/", authMiddleware, pagoTransController.getAll);
router.get("/search", authMiddleware, pagoTransController.search);
router.get("/:id", authMiddleware, pagoTransController.getById);
router.post("/", authMiddleware, pagoTransController.create);
router.put("/:id", authMiddleware, pagoTransController.update);
router.delete("/:id", authMiddleware, pagoTransController.delete);

module.exports = router;
