const express = require("express");
const router = express.Router();
const registroDiarioCajaController = require("../controllers/registrodiariocaja.controller");
const authMiddleware = require("../middlewares/auth");
const reportePermiso = require("../middlewares/reportePermiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para registros diarios de caja
router.get("/", authMiddleware, registroDiarioCajaController.getAll);
router.get("/search", authMiddleware, registroDiarioCajaController.search);
router.get(
  "/estado-apertura",
  registroDiarioCajaController.estadoAperturaPorUsuario
);
router.get("/mi-caja", registroDiarioCajaController.miCaja);
router.get(
  "/ultimo-cierre",
  authMiddleware,
  registroDiarioCajaController.ultimoCierrePorCaja
);
router.get(
  "/reporte-pase-cajas",
  authMiddleware,
  reportePermiso("REPORTEPASECAJAS"),
  registroDiarioCajaController.reportePaseCajas
);
router.get(
  "/reporte-movimientos-cajas",
  authMiddleware,
  reportePermiso("REPORTEREGISTRODIARIO", "REPORTEPORCAJA", "REPORTEMOVIMIENTOSCAJAS"),
  registroDiarioCajaController.reporteMovimientosCajas
);
router.get(
  "/reporte-cierre-diario",
  authMiddleware,
  reportePermiso("REPORTECIERREDIARIO"),
  registroDiarioCajaController.reporteCierreDiario
);
router.get(
  "/reporte-ingresos-egresos",
  authMiddleware,
  reportePermiso("REPORTEINGRESOSEGRESOS"),
  registroDiarioCajaController.reporteIngresosEgresos
);
router.get(
  "/reporte-western",
  authMiddleware,
  reportePermiso("REPORTEWESTERN", "REPORTEWESTERNUSD"),
  registroDiarioCajaController.reporteWestern
);
router.get(
  "/reporte-anticipos",
  authMiddleware,
  reportePermiso("REPORTEANTICIPOS"),
  registroDiarioCajaController.reporteAnticipos
);
router.get(
  "/reporte-el-comercio",
  authMiddleware,
  reportePermiso("REPORTEELCOMERCIO"),
  registroDiarioCajaController.reporteElComercio
);
router.get("/:id", authMiddleware, registroDiarioCajaController.getById);
router.post("/", authMiddleware, registroDiarioCajaController.create);
router.post("/pase", authMiddleware, registroDiarioCajaController.createPase);
router.post(
  "/apertura-cierre",
  authMiddleware,
  registroDiarioCajaController.aperturaCierreCaja
);
router.put("/:id", authMiddleware, registroDiarioCajaController.update);
router.delete("/:id", authMiddleware, registroDiarioCajaController.delete);

module.exports = router;
