-- Auditoría de correcciones y eliminaciones de movimientos de caja que tocan
-- un turno: cada corrección de monto/detalle (Registro Diario de Caja o
-- edición de una cobranza de colegio) y cada eliminación de un movimiento de
-- un turno ya cerrado. Guarda lo que había, lo que quedó, el efecto en la
-- diferencia de ese cierre, quién lo hizo y por qué, para que una corrección
-- no pueda tapar un faltante sin dejar rastro.
-- Es idempotente. CORRER ANTES DE DEPLOYAR la API que la usa (sin la tabla,
-- corregir y eliminar movimientos falla).

BEGIN;

CREATE TABLE IF NOT EXISTS registrocorreccion (
  "RegistroCorreccionId"         serial        PRIMARY KEY,
  -- Sin FK: el rastro tiene que quedar aunque el movimiento se elimine
  "RegistroDiarioCajaId"         integer       NOT NULL,
  "RegistroCorreccionTipo"       varchar(12)   NOT NULL
                                 CHECK ("RegistroCorreccionTipo" IN ('CORRECCION', 'ELIMINACION')),
  "CajaId"                       integer       NOT NULL REFERENCES caja ("CajaId"),
  -- Fila CIERRE del turno ya cerrado al que pertenecía (null: turno abierto)
  "RegistroCorreccionCierreId"   integer,
  "RegistroCorreccionMontoAnterior"   numeric(14,2) NOT NULL,
  "RegistroCorreccionMontoNuevo"      numeric(14,2), -- null en una eliminación
  "RegistroCorreccionDetalleAnterior" text,
  "RegistroCorreccionDetalleNuevo"    text,
  -- Diferencia del cierre antes y después (sólo con turno cerrado)
  "RegistroCorreccionDiferenciaAnterior" numeric(14,2),
  "RegistroCorreccionDiferenciaNueva"    numeric(14,2),
  "RegistroCorreccionMotivo"     varchar(500)  NOT NULL,
  "UsuarioId"                    varchar(12)   NOT NULL,
  "RegistroCorreccionFecha"      timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrocorreccion_registro ON registrocorreccion ("RegistroDiarioCajaId");
CREATE INDEX IF NOT EXISTS idx_registrocorreccion_cierre ON registrocorreccion ("RegistroCorreccionCierreId");
CREATE INDEX IF NOT EXISTS idx_registrocorreccion_fecha ON registrocorreccion ("RegistroCorreccionFecha");

COMMIT;
