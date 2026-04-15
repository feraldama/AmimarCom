const express = require("express");
const router = express.Router();
const colegiocursoController = require("../controllers/colegiocurso.controller");
const authMiddleware = require("../middlewares/auth");

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
router.post("/", authMiddleware, colegiocursoController.create);
router.put(
  "/:colegioId/:cursoId",
  authMiddleware,
  colegiocursoController.update
);
router.delete(
  "/:colegioId/:cursoId",
  authMiddleware,
  colegiocursoController.delete
);

module.exports = router;
