-- Cierre Diario Gerencial: a lo sumo una fila por caja y fecha.
-- La API ya serializa el snapshot con un lock advisory; este índice es la
-- garantía a nivel base por si algo inserta por fuera de la API.
--
-- Es PARCIAL (sólo desde 2026-10-19): la historia tiene 6.214 filas
-- duplicadas en 65 fechas entre 2021-09-14 y 2026-03-23 (snapshots
-- registrados dos veces el mismo día, 1.266 de ellos con montos distintos).
-- Se decidió no tocarlas, así que el índice no puede cubrir esas fechas.
-- Es idempotente. Ya aplicada en producción el 2026-10-19.

-- Control: duplicados desde la fecha de corte (debería salir vacío)
SELECT "CierreDiarioFecha", "CajaId", COUNT(*) AS cant
FROM cierrediario
WHERE "CierreDiarioFecha" >= DATE '2026-10-19'
GROUP BY "CierreDiarioFecha", "CajaId"
HAVING COUNT(*) > 1
ORDER BY "CierreDiarioFecha", "CajaId";

CREATE UNIQUE INDEX IF NOT EXISTS cierrediario_fecha_caja_uq
  ON cierrediario ("CierreDiarioFecha", "CajaId")
  WHERE "CierreDiarioFecha" >= DATE '2026-10-19';
