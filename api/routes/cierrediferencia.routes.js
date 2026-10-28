const express = require("express");
const router = express.Router();
const cierreDiferenciaController = require("../controllers/cierrediferencia.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.use(authMiddleware);

router.get(
  "/",
  verificarPermiso("CIERREDIFERENCIAS", "leer"),
  cierreDiferenciaController.getAll
);
// Grupos que se pueden agregar a un cierre como movimiento suelto
router.get(
  "/grupos-alta",
  verificarPermiso("CIERREDIFERENCIAS", "editar"),
  cierreDiferenciaController.getGruposAlta
);
router.get(
  "/:id",
  verificarPermiso("CIERREDIFERENCIAS", "leer"),
  cierreDiferenciaController.getDetalle
);
// Agregar a ese cierre un movimiento que faltó cargar (recalcula la diferencia)
router.post(
  "/:id/movimientos",
  verificarPermiso("CIERREDIFERENCIAS", "editar"),
  cierreDiferenciaController.agregarMovimiento
);
// Lo que haría agregar ese movimiento (cajas, duplicados), sin guardar
router.post(
  "/:id/movimientos/previsualizar",
  verificarPermiso("CIERREDIFERENCIAS", "editar"),
  cierreDiferenciaController.previsualizarMovimiento
);
router.put(
  "/:id",
  verificarPermiso("CIERREDIFERENCIAS", "editar"),
  cierreDiferenciaController.updateRevision
);

module.exports = router;
