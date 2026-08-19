-- Comisión (%) que se cobra por cada cobranza del colegio.
-- Base de cálculo: (importe de la cuota - descuento) de cada cobranza.
-- Ejemplo: cuota 320.000 con comisión 1,50% => 4.800 Gs.
ALTER TABLE "colegio"
  ADD COLUMN IF NOT EXISTS "ColegioComision" numeric(5,2) NOT NULL DEFAULT 0;
