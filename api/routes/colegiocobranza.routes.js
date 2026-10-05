const express = require("express");
const router = express.Router();
const colegiocobranzaController = require("../controllers/colegiocobranza.controller");
const authMiddleware = require("../middlewares/auth");
const reportePermiso = require("../middlewares/reportePermiso");
const verificarPermiso = require("../middlewares/permiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para cobranzas
router.get("/", authMiddleware, colegiocobranzaController.getAll);
router.get("/search", authMiddleware, colegiocobranzaController.search);
router.get(
  "/reporte",
  authMiddleware,
  reportePermiso("REPORTECOLEGIOS"),
  colegiocobranzaController.reporteCobranzas
);
router.get("/:id", authMiddleware, colegiocobranzaController.getById);
// Crear: los cajeros desde Cobranzas (OPERARCAJA) o la pantalla de cobranzas
router.post(
  "/",
  authMiddleware,
  verificarPermiso(["OPERARCAJA", "COLEGIOCOBRANZA"], "crear"),
  colegiocobranzaController.create
);
router.put(
  "/:id",
  authMiddleware,
  verificarPermiso("COLEGIOCOBRANZA", "editar"),
  colegiocobranzaController.update
);
router.delete(
  "/:id",
  authMiddleware,
  verificarPermiso("COLEGIOCOBRANZA", "eliminar"),
  colegiocobranzaController.delete
);

module.exports = router;
