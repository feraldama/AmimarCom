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
// Reporte sin límite "solo su caja" (ver reportePermiso): mezcla cajas por
// naturaleza, limitado a una caja daría un resultado sin sentido. Quien
// tenga el permiso ve todos los colegios y todas las cajas.
router.get(
  "/estado-resultados",
  authMiddleware,
  verificarPermiso(["REPORTES", "REPORTEESTADORESULTADOS"], "leer"),
  colegioController.estadoResultados
);
router.get(
  "/estado-resultados-mensual",
  authMiddleware,
  verificarPermiso(["REPORTES", "REPORTEESTADORESULTADOS"], "leer"),
  colegioController.estadoResultadosMensual
);
router.get("/:id", authMiddleware, colegioController.getById);
// Conceptos del estado de resultados: se editan desde editar colegio
router.get(
  "/:id/conceptos-resultado",
  authMiddleware,
  colegioController.getConceptosResultado
);
router.post(
  "/:id/conceptos-resultado",
  authMiddleware,
  verificarPermiso("COLEGIO", "editar"),
  colegioController.addConceptoResultado
);
router.delete(
  "/:id/conceptos-resultado/:tipoGastoId/:tipoGastoGrupoId",
  authMiddleware,
  verificarPermiso("COLEGIO", "editar"),
  colegioController.deleteConceptoResultado
);
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
