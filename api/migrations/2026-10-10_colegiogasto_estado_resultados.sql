-- Reporte "Estado de Resultados - Colegios": por colegio,
--   INGRESOS - RETIROS - SALARIOS = RESULTADO
-- tomados de registrodiariocaja por concepto (TipoGastoId + TipoGastoGrupoId).
--
-- colegiogasto: qué conceptos de caja suman a cada rubro de cada colegio.
-- - INGRESO: el concepto propio del colegio (colegio.TipoGastoId/GrupoId, el
--   de las cobranzas) ya cuenta siempre; acá van solo ingresos adicionales.
-- - RETIRO / SALARIO: egresos (TipoGastoId = 1) del colegio. Los anticipos
--   de salario de profesores van como SALARIO.
-- Se mantiene desde la pantalla de Colegios (editar colegio > "Conceptos del
-- estado de resultados").
-- Es idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS "colegiogasto" (
  "ColegioId" integer NOT NULL,
  "TipoGastoId" integer NOT NULL,
  "TipoGastoGrupoId" smallint NOT NULL,
  "ColegioGastoRubro" varchar(10) NOT NULL
    CHECK ("ColegioGastoRubro" IN ('INGRESO', 'RETIRO', 'SALARIO')),
  PRIMARY KEY ("ColegioId", "TipoGastoId", "TipoGastoGrupoId"),
  CONSTRAINT "fk_colegiogasto_colegio" FOREIGN KEY ("ColegioId")
    REFERENCES "colegio" ("ColegioId") ON DELETE CASCADE,
  CONSTRAINT "fk_colegiogasto_tipogastogrupo" FOREIGN KEY ("TipoGastoId", "TipoGastoGrupoId")
    REFERENCES "tipogastogrupo" ("TipoGastoId", "TipoGastoGrupoId")
);

-- Un concepto pertenece a un solo colegio (si no, se sumaría en dos y el
-- total general lo contaría doble)
CREATE UNIQUE INDEX IF NOT EXISTS "colegiogasto_concepto_uk"
  ON "colegiogasto" ("TipoGastoId", "TipoGastoGrupoId");

-- Rol de la aplicación (solo existe en producción)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amimarcom_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "colegiogasto" TO amimarcom_app;
  END IF;
END $$;

-- Conceptos según tipogastogrupo de producción al 2026-10-10
INSERT INTO "colegiogasto" ("ColegioId", "TipoGastoId", "TipoGastoGrupoId", "ColegioGastoRubro") VALUES
  -- 1 Juan Crisostomo Centurion
  (1, 2, 41, 'INGRESO'),  -- JCC LIBROS
  (1, 1, 44, 'RETIRO'),   -- RETIRO JCC
  (1, 1, 31, 'SALARIO'),  -- SALARIOS PROFESORES JCC
  (1, 1, 49, 'SALARIO'),  -- ANTICIPO JCC
  -- 2 Arandu Rape
  (2, 1, 45, 'RETIRO'),   -- RETIRO ARANDU1
  (2, 1, 32, 'SALARIO'),  -- SALARIOS PROF. ARANDU1
  (2, 1, 50, 'SALARIO'),  -- ANTICIPO ARANDU1
  -- 3 Academia de danza Maria Elena
  (3, 1, 92, 'RETIRO'),   -- RETIRO MARIA ELENA ALCARAZ
  -- 4 Academia de danza Positiva
  (4, 1, 46, 'RETIRO'),   -- RETIRO POSITIVA2
  (4, 1, 33, 'SALARIO'),  -- SALARIOS PROF. POSITIVA2
  (4, 1, 51, 'SALARIO'),  -- ANTICIPO POSITIVA2
  -- 5 Escuela de danza Noemi Adorno
  (5, 1, 48, 'RETIRO'),   -- RETIRO NOEMI ADORNO3
  (5, 1, 35, 'SALARIO'),  -- SALARIOS PROF. NOEMI4
  (5, 1, 53, 'SALARIO'),  -- ANTICIPO NOEMI ADORNO4
  -- 6 Academia de danza Alice Martinez
  (6, 1, 47, 'RETIRO'),   -- RETIRO ALICE MARTINEZ ACADEMIA
  (6, 1, 60, 'SALARIO'),  -- SALARIOS PROF. ALICE MAR5
  -- 7 Academia Celeste Perez
  (7, 1, 91, 'RETIRO')    -- RETIRO CELESTE PEREZ
ON CONFLICT DO NOTHING;

-- Permiso específico del reporte (ver client/src/utils/accesoRutas.ts).
-- Ve todos los colegios y todas las cajas (el reporte no filtra por caja).
-- Se da solo lectura al perfil ESCUELAS (5) de sramirez; además lo ven los
-- admin y quien tenga REPORTES.
INSERT INTO menu ("MenuId", "MenuNombre") VALUES
  ('reporteestadoresultados', 'REPORTEESTADORESULTADOS')
ON CONFLICT DO NOTHING;

INSERT INTO perfilmenu ("PerfilId", "MenuId", "puedeCrear", "puedeEditar", "puedeEliminar", "puedeLeer") VALUES
  (5, 'reporteestadoresultados', 0, 0, 0, 1)
ON CONFLICT DO NOTHING;

COMMIT;

-- Control: conceptos mapeados que no existen en tipogastogrupo (debe dar 0 filas)
SELECT cg.*
FROM "colegiogasto" cg
LEFT JOIN tipogastogrupo g
  ON g."TipoGastoId" = cg."TipoGastoId" AND g."TipoGastoGrupoId" = cg."TipoGastoGrupoId"
WHERE g."TipoGastoId" IS NULL;
