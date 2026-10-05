const express = require("express");
const router = express.Router();
const colegioController = require("../controllers/colegio.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para colegios
router.get("/", authMiddleware, colegioController.getAll);
router.get("/search", authMiddleware, colegioController.search);
router.get("/:id", authMiddleware, colegioController.getById);
router.post(
  "/",
  authMiddleware,
  verificarPermiso("COLEGIO", "crear"),
  colegioController.create
);
router.put(
  "/:id",
  authMiddleware,
  verificarPermiso("COLEGIO", "editar"),
  colegioController.update
);
router.delete(
  "/:id",
  authMiddleware,
  verificarPermiso("COLEGIO", "eliminar"),
  colegioController.delete
);

module.exports = router;
