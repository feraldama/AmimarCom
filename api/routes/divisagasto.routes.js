const express = require("express");
const router = express.Router();
const divisaGastoController = require("../controllers/divisagasto.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para gastos de divisa
router.get("/", authMiddleware, divisaGastoController.getAll);
router.get(
  "/divisa/:divisaId",
  authMiddleware,
  divisaGastoController.getByDivisaId
);
router.get("/:id", authMiddleware, divisaGastoController.getById);
router.post("/", authMiddleware, divisaGastoController.create);
router.put("/:id", authMiddleware, divisaGastoController.update);
router.delete("/:id", authMiddleware, divisaGastoController.delete);

module.exports = router;
