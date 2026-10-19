-- Cereo mensual de cajas de colegios (CajaTipoId 4) y de anticipos (nombre con
-- "ANTICIPO"): el día 1 de cada mes a las 00:00 (hora de Paraguay) la API pone
-- su CajaMonto en 0 (ver api/jobs/cereoMensual.js).
-- Esta tabla registra cada cereo: marca el mes como hecho, así un reinicio de
-- la API ese día no vuelve a cerear (perdería los movimientos del día), y
-- guarda el saldo que tenía cada caja antes de ponerla en 0.
-- Es idempotente.

CREATE TABLE IF NOT EXISTS cajacereo (
  "CajaCereoMes"           date          NOT NULL, -- primer día del mes cereado
  "CajaId"                 integer       NOT NULL REFERENCES caja ("CajaId"),
  "CajaCereoMontoAnterior" numeric(14,2) NOT NULL,
  "CajaCereoFecha"         timestamp     NOT NULL DEFAULT now(),
  PRIMARY KEY ("CajaCereoMes", "CajaId")
);
