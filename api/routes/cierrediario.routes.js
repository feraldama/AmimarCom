const express = require("express");
const router = express.Router();
const cierreDiarioController = require("../controllers/cierrediario.controller");
const authMiddleware = require("../middlewares/auth");

router.use(authMiddleware);

router.get("/", cierreDiarioController.getHistorial);
router.get("/detail/:fecha", cierreDiarioController.getDetail);
router.post("/snapshot", cierreDiarioController.createSnapshot);

module.exports = router;
