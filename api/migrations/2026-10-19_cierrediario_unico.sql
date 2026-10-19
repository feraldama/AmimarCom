-- Cierre Diario Gerencial: a lo sumo una fila por caja y fecha.
-- La API ya serializa el snapshot con un lock advisory; este índice es la
-- garantía a nivel base por si algo inserta por fuera de la API.
-- Es idempotente. Si el CREATE falla por duplicados, el SELECT de control de
-- abajo los lista: hay que borrar los sobrantes antes de volver a correrlo.

-- Control: fechas/cajas duplicadas (debería salir vacío)
SELECT "CierreDiarioFecha", "CajaId", COUNT(*) AS cant
FROM cierrediario
GROUP BY "CierreDiarioFecha", "CajaId"
HAVING COUNT(*) > 1
ORDER BY "CierreDiarioFecha", "CajaId";

CREATE UNIQUE INDEX IF NOT EXISTS cierrediario_fecha_caja_uq
  ON cierrediario ("CierreDiarioFecha", "CajaId");
