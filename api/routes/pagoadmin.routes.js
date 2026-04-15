const express = require("express");
const router = express.Router();
const pagoAdminController = require("../controllers/pagoadmin.controller");
const authMiddleware = require("../middlewares/auth");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para pagos admin
router.get("/", authMiddleware, pagoAdminController.getAll);
router.get("/search", authMiddleware, pagoAdminController.search);
router.get("/:id", authMiddleware, pagoAdminController.getById);
router.post("/", authMiddleware, pagoAdminController.create);
router.put("/:id", authMiddleware, pagoAdminController.update);
router.delete("/:id", authMiddleware, pagoAdminController.delete);

module.exports = router;
