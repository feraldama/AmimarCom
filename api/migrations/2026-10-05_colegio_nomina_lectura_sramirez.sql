-- Permisos COLEGIO y NOMINA (los que verifican ColegiosPage y NominasPage, y
-- desde este cambio también el backend al crear/editar/eliminar colegios,
-- cursos y nóminas). Se da solo lectura al perfil ESCUELAS (SOLO LECTURA) (5)
-- de sramirez. Los cajeros siguen creando nóminas desde Cobranzas con
-- OPERARCAJA. Es idempotente.

BEGIN;

INSERT INTO menu ("MenuId", "MenuNombre") VALUES
  ('colegio', 'COLEGIO'),
  ('nomina', 'NOMINA')
ON CONFLICT DO NOTHING;

INSERT INTO perfilmenu ("PerfilId", "MenuId", "puedeCrear", "puedeEditar", "puedeEliminar", "puedeLeer") VALUES
  (5, 'colegio', 0, 0, 0, 1),
  (5, 'nomina', 0, 0, 0, 1)
ON CONFLICT DO NOTHING;

COMMIT;
