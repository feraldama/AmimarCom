const express = require("express");
const router = express.Router();
const colegiocobranzaController = require("../controllers/colegiocobranza.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para cobranzas
router.get("/", authMiddleware, colegiocobranzaController.getAll);
router.get("/search", authMiddleware, colegiocobranzaController.search);
router.get("/:id", authMiddleware, colegiocobranzaController.getById);
router.post("/", authMiddleware, colegiocobranzaController.create);
router.put("/:id", authMiddleware, colegiocobranzaController.update);
router.delete("/:id", authMiddleware, colegiocobranzaController.delete);

module.exports = router;
