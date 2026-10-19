const express = require("express");
const router = express.Router();
const cierreDiarioController = require("../controllers/cierrediario.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

router.use(authMiddleware);

router.get(
  "/",
  verificarPermiso("CIERREDIARIO", "leer"),
  cierreDiarioController.getHistorial
);
router.get(
  "/detail/:fecha",
  verificarPermiso("CIERREDIARIO", "leer"),
  cierreDiarioController.getDetail
);
router.post(
  "/snapshot",
  verificarPermiso("CIERREDIARIO", "crear"),
  cierreDiarioController.createSnapshot
);

module.exports = router;
