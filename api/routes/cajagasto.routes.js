const express = require("express");
const router = express.Router();
const cajagastoController = require("../controllers/cajagasto.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para CajaGasto
router.get("/", authMiddleware, cajagastoController.getAll);
router.get("/caja/:cajaId", authMiddleware, cajagastoController.getByCajaId);
router.get(
  "/tipo/:tipoGastoId/grupo/:tipoGastoGrupoId",
  authMiddleware,
  cajagastoController.getByTipoGastoAndGrupo
);
router.get("/:id", authMiddleware, cajagastoController.getById);
router.post("/", authMiddleware, cajagastoController.create);
router.put("/:id", authMiddleware, cajagastoController.update);
router.delete("/:id", authMiddleware, cajagastoController.delete);

module.exports = router;
