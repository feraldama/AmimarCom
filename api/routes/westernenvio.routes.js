const express = require("express");
const router = express.Router();
const westernEnvioController = require("../controllers/westernenvio.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para envíos western
router.get("/", authMiddleware, westernEnvioController.getAll);
router.get("/search", authMiddleware, westernEnvioController.search);
router.get("/:id", authMiddleware, westernEnvioController.getById);
router.post("/", authMiddleware, westernEnvioController.create);
// Editar/reclasificar y eliminar corrigen la caja: exigen el permiso del menú
// (la pantalla ya los pedía, la API no)
router.put(
  "/:id",
  authMiddleware,
  verificarPermiso("WESTERNENVIO", "editar"),
  westernEnvioController.update
);
router.delete(
  "/:id",
  authMiddleware,
  verificarPermiso("WESTERNENVIO", "eliminar"),
  westernEnvioController.delete
);

module.exports = router;
