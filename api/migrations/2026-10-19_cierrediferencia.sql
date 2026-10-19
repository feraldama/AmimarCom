-- Diferencias de cierre de caja (sobrante/faltante de cada turno), para
-- revisarlas después en "Diferencias de Cierre" (/cierre-diferencias).
-- La API la llena en cada cierre (RegistroDiarioCaja.aperturaCierre); acá se
-- crea y se reconstruye la historia con la misma fórmula del ticket:
--   teórico    = apertura + ingresos - egresos (sin las filas de turno, grupo 2)
--   diferencia = teórico - contado   (> 0 faltante, < 0 sobrante)
-- Permiso nuevo CIERREDIFERENCIAS (leer: ver; editar: observación/revisado).
-- No se asigna a ningún perfil: los admin pasan siempre.
-- Es idempotente. CORRER ANTES DE DEPLOYAR la API que la usa (sin la tabla,
-- el cierre de caja falla).

BEGIN;

CREATE TABLE IF NOT EXISTS cierrediferencia (
  -- La fila CIERRE del turno en registrodiariocaja. Si se borra el cierre (para
  -- reabrir la caja) su diferencia deja de tener sentido y se borra con él.
  "RegistroDiarioCajaId"         integer       PRIMARY KEY
                                 REFERENCES registrodiariocaja ("RegistroDiarioCajaId") ON DELETE CASCADE,
  "CierreDiferenciaAperturaId"   integer       NOT NULL, -- fila APERTURA del turno
  "CajaId"                       integer       NOT NULL REFERENCES caja ("CajaId"),
  "UsuarioId"                    varchar(12)   NOT NULL,
  "CierreDiferenciaFecha"        timestamp     NOT NULL,
  "CierreDiferenciaApertura"     numeric(14,2) NOT NULL,
  "CierreDiferenciaIngresos"     numeric(14,2) NOT NULL,
  "CierreDiferenciaEgresos"      numeric(14,2) NOT NULL,
  "CierreDiferenciaTeorico"      numeric(14,2) NOT NULL,
  "CierreDiferenciaContado"      numeric(14,2) NOT NULL,
  "CierreDiferenciaMonto"        numeric(14,2) NOT NULL,
  "CierreDiferenciaObservacion"  varchar(500),
  "CierreDiferenciaRevisado"     boolean       NOT NULL DEFAULT false,
  "CierreDiferenciaRevisadoPor"  varchar(12),
  "CierreDiferenciaRevisadoFecha" timestamp
);

CREATE INDEX IF NOT EXISTS idx_cierrediferencia_fecha ON cierrediferencia ("CierreDiferenciaFecha");
CREATE INDEX IF NOT EXISTS idx_cierrediferencia_caja ON cierrediferencia ("CajaId");

-- Historia: cada cierre con la apertura inmediatamente anterior de su caja
INSERT INTO cierrediferencia (
  "RegistroDiarioCajaId", "CierreDiferenciaAperturaId", "CajaId", "UsuarioId",
  "CierreDiferenciaFecha", "CierreDiferenciaApertura", "CierreDiferenciaIngresos",
  "CierreDiferenciaEgresos", "CierreDiferenciaTeorico", "CierreDiferenciaContado",
  "CierreDiferenciaMonto"
)
SELECT
  c."RegistroDiarioCajaId", ap."RegistroDiarioCajaId", c."CajaId", c."UsuarioId",
  c."RegistroDiarioCajaFecha", ap."RegistroDiarioCajaMonto", m.ingresos, m.egresos,
  ap."RegistroDiarioCajaMonto" + m.ingresos - m.egresos,
  c."RegistroDiarioCajaMonto",
  ap."RegistroDiarioCajaMonto" + m.ingresos - m.egresos - c."RegistroDiarioCajaMonto"
FROM registrodiariocaja c
JOIN LATERAL (
  SELECT a."RegistroDiarioCajaId", a."RegistroDiarioCajaMonto"
  FROM registrodiariocaja a
  WHERE a."CajaId" = c."CajaId" AND a."TipoGastoId" = 2 AND a."TipoGastoGrupoId" = 2
    AND a."RegistroDiarioCajaId" < c."RegistroDiarioCajaId"
  ORDER BY a."RegistroDiarioCajaId" DESC LIMIT 1
) ap ON TRUE
JOIN LATERAL (
  SELECT
    COALESCE(SUM(CASE WHEN r."TipoGastoId" = 2 THEN r."RegistroDiarioCajaMonto" END), 0) AS ingresos,
    COALESCE(SUM(CASE WHEN r."TipoGastoId" = 1 THEN r."RegistroDiarioCajaMonto" END), 0) AS egresos
  FROM registrodiariocaja r
  WHERE r."CajaId" = c."CajaId" AND r."TipoGastoGrupoId" <> 2
    AND r."RegistroDiarioCajaId" > ap."RegistroDiarioCajaId"
    AND r."RegistroDiarioCajaId" < c."RegistroDiarioCajaId"
) m ON TRUE
WHERE c."TipoGastoId" = 1 AND c."TipoGastoGrupoId" = 2
ON CONFLICT DO NOTHING;

INSERT INTO menu ("MenuId", "MenuNombre") VALUES ('cierrediferencias', 'CIERREDIFERENCIAS')
ON CONFLICT DO NOTHING;

COMMIT;

-- Control
SELECT COUNT(*) AS cierres,
       COUNT(*) FILTER (WHERE "CierreDiferenciaMonto" > 0) AS faltantes,
       COUNT(*) FILTER (WHERE "CierreDiferenciaMonto" < 0) AS sobrantes
FROM cierrediferencia;
