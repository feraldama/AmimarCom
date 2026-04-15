const express = require("express");
const router = express.Router();
const divisaController = require("../controllers/divisa.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para divisas
router.get("/", authMiddleware, divisaController.getAll);
router.get("/search", authMiddleware, divisaController.search);
router.get("/:id", authMiddleware, divisaController.getById);
router.post("/", authMiddleware, divisaController.create);
router.put("/:id", authMiddleware, divisaController.update);
router.delete("/:id", authMiddleware, divisaController.delete);

module.exports = router;
