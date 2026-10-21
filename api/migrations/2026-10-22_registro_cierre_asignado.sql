-- Movimientos agregados a un cierre anterior (Diferencias de Cierre >
-- "Agregar movimiento faltante").
--
-- El turno de una caja se arma por rango de IDs entre la apertura y el cierre,
-- así que un movimiento olvidado que se carga después del cierre caería en el
-- turno en curso. "RegistroDiarioCajaCierreId" lo asigna al turno de ese
-- cierre: cuenta en su ticket y en su diferencia, y no en el turno en curso
-- (ver getSaldoTeorico, getTurnoCierre, CierreDiferencia.registrarParaCierre).
-- NULL (todos los movimientos normales): el turno sale del rango de IDs.
-- Si se borra la fila de cierre (reabrir la caja), el movimiento vuelve al
-- rango de IDs.
--
-- La auditoría (registrocorreccion) suma el tipo ALTA.
-- Es idempotente. Correr con el usuario de la app ANTES DE DEPLOYAR la API.

BEGIN;

ALTER TABLE registrodiariocaja
  ADD COLUMN IF NOT EXISTS "RegistroDiarioCajaCierreId" integer
  REFERENCES registrodiariocaja ("RegistroDiarioCajaId") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registrodiariocaja_cierreid
  ON registrodiariocaja ("RegistroDiarioCajaCierreId")
  WHERE "RegistroDiarioCajaCierreId" IS NOT NULL;

ALTER TABLE registrocorreccion
  DROP CONSTRAINT IF EXISTS "registrocorreccion_RegistroCorreccionTipo_check";
ALTER TABLE registrocorreccion
  DROP CONSTRAINT IF EXISTS registrocorreccion_tipo_check;
ALTER TABLE registrocorreccion
  ADD CONSTRAINT registrocorreccion_tipo_check
  CHECK ("RegistroCorreccionTipo" IN ('CORRECCION', 'ELIMINACION', 'ALTA'));

COMMIT;
