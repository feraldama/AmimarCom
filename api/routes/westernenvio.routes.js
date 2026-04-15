const express = require("express");
const router = express.Router();
const westernEnvioController = require("../controllers/westernenvio.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para envíos western
router.get("/", authMiddleware, westernEnvioController.getAll);
router.get("/search", authMiddleware, westernEnvioController.search);
router.get("/:id", authMiddleware, westernEnvioController.getById);
router.post("/", authMiddleware, westernEnvioController.create);
router.put("/:id", authMiddleware, westernEnvioController.update);
router.delete("/:id", authMiddleware, westernEnvioController.delete);

module.exports = router;
