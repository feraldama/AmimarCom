const express = require("express");
const router = express.Router();
const jsicobroController = require("../controllers/jsicobro.controller");
const authMiddleware = require("../middlewares/auth");
const reportePermiso = require("../middlewares/reportePermiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para cobros de JSI
router.get("/", authMiddleware, jsicobroController.getAll);
router.get("/search", authMiddleware, jsicobroController.search);
router.get("/reporte", authMiddleware, reportePermiso("REPORTEJSI"), jsicobroController.reporteCobros);
router.get("/:id", authMiddleware, jsicobroController.getById);
router.post("/", authMiddleware, jsicobroController.create);
router.put("/:id", authMiddleware, jsicobroController.update);
router.delete("/:id", authMiddleware, jsicobroController.delete);

module.exports = router;
