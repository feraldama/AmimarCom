const express = require("express");
const router = express.Router();
const colegiocursoController = require("../controllers/colegiocurso.controller");
const authMiddleware = require("../middlewares/auth");
const verificarPermiso = require("../middlewares/permiso");

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Rutas para cursos de colegios
router.get("/", authMiddleware, colegiocursoController.getAll);
router.get(
  "/by-colegio/:colegioId",
  authMiddleware,
  colegiocursoController.getByColegioId
);
router.get(
  "/:colegioId/:cursoId",
  authMiddleware,
  colegiocursoController.getById
);
// Los cursos se cargan al crear o editar el colegio
router.post(
  "/",
  authMiddleware,
  verificarPermiso("COLEGIO", ["crear", "editar"]),
  colegiocursoController.create
);
router.put(
  "/:colegioId/:cursoId",
  authMiddleware,
  verificarPermiso("COLEGIO", "editar"),
  colegiocursoController.update
);
router.delete(
  "/:colegioId/:cursoId",
  authMiddleware,
  verificarPermiso("COLEGIO", "editar"),
  colegiocursoController.delete
);

module.exports = router;
