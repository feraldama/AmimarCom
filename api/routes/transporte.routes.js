const express = require("express");
const router = express.Router();
const transporteController = require("../controllers/transporte.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para transportes
router.get("/", authMiddleware, transporteController.getAll);
router.get("/search", authMiddleware, transporteController.search);
router.get("/:id", authMiddleware, transporteController.getById);
router.post("/", authMiddleware, transporteController.create);
router.put("/:id", authMiddleware, transporteController.update);
router.delete("/:id", authMiddleware, transporteController.delete);

module.exports = router;
