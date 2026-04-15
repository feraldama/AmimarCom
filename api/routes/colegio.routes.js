const express = require("express");
const router = express.Router();
const colegioController = require("../controllers/colegio.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para colegios
router.get("/", authMiddleware, colegioController.getAll);
router.get("/search", authMiddleware, colegioController.search);
router.get("/:id", authMiddleware, colegioController.getById);
router.post("/", authMiddleware, colegioController.create);
router.put("/:id", authMiddleware, colegioController.update);
router.delete("/:id", authMiddleware, colegioController.delete);

module.exports = router;
