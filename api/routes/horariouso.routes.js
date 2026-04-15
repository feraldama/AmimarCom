const express = require("express");
const router = express.Router();
const horarioUsoController = require("../controllers/horariouso.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para HorarioUso
router.get("/search", authMiddleware, horarioUsoController.searchHorarios);
router.get("/", authMiddleware, horarioUsoController.getAll);
router.get("/:id", authMiddleware, horarioUsoController.getById);
router.post("/", authMiddleware, horarioUsoController.create);
router.put("/:id", authMiddleware, horarioUsoController.update);
router.delete("/:id", authMiddleware, horarioUsoController.delete);

module.exports = router;
