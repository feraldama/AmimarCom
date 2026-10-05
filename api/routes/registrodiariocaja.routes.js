const express = require("express");
const router = express.Router();
const registroDiarioCajaController = require("../controllers/registrodiariocaja.controller");
const authMiddleware = require("../middlewares/auth");
const reportePermiso = require("../middlewares/reportePermiso");
const verificarPermiso = require("../middlewares/permiso");

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
  "/saldo-caja-abierta",
  registroDiarioCajaController.saldoCajaAbierta
);
router.get("/turno-cierre", registroDiarioCajaController.turnoCierre);
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
// Operar la caja (cobros, pases, apertura/cierre) exige OPERARCAJA (perfil de
// cajeros); la carga manual desde Registro Diario Caja, REGISTRODIARIOCAJA
router.post(
  "/",
  authMiddleware,
  verificarPermiso(["OPERARCAJA", "REGISTRODIARIOCAJA"], "crear"),
  registroDiarioCajaController.create
);
router.post(
  "/pase",
  authMiddleware,
  verificarPermiso("OPERARCAJA", "crear"),
  registroDiarioCajaController.createPase
);
router.post(
  "/apertura-cierre",
  authMiddleware,
  verificarPermiso("OPERARCAJA", "crear"),
  registroDiarioCajaController.aperturaCierreCaja
);
router.put(
  "/:id",
  authMiddleware,
  verificarPermiso("REGISTRODIARIOCAJA", "editar"),
  registroDiarioCajaController.update
);
// También lo usa Movimientos de Divisas para borrar el registro asociado
router.delete(
  "/:id",
  authMiddleware,
  verificarPermiso(["REGISTRODIARIOCAJA", "DIVISAMOVIMIENTO"], "eliminar"),
  registroDiarioCajaController.delete
);

module.exports = router;
