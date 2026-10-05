const express = require("express");
const router = express.Router();
const nominaController = require("../controllers/nomina.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para nominas
router.get("/", authMiddleware, nominaController.getAll);
router.get("/all", authMiddleware, nominaController.getAllNominasSinPaginacion);
router.get("/search", authMiddleware, nominaController.search);
router.get("/:id", authMiddleware, nominaController.getById);
// Crear: también los cajeros, al cobrar un alumno nuevo en Cobranzas
router.post(
  "/",
  authMiddleware,
  verificarPermiso(["OPERARCAJA", "NOMINA"], "crear"),
  nominaController.create
);
router.put(
  "/:id",
  authMiddleware,
  verificarPermiso("NOMINA", "editar"),
  nominaController.update
);
router.delete(
  "/:id",
  authMiddleware,
  verificarPermiso("NOMINA", "eliminar"),
  nominaController.delete
);

module.exports = router;
