-- Permisos nuevos (ver client/src/utils/accesoRutas.ts y middlewares/reportePermiso.js):
-- - OPERARCAJA: aperturar/cerrar caja y cobrar (Cobranzas). Lo exige el
--   backend en POST /registrodiariocaja, /pase, /apertura-cierre y
--   POST /colegiocobranza. Se da al perfil VENDEDOR (2), que tienen todos
--   los cajeros. CORRER ANTES DE DEPLOYAR la API/front que lo exigen, o los
--   cajeros quedan sin poder operar.
-- - REPORTESTODASCAJAS: quita el límite "solo su caja" a los reportes
--   específicos que el usuario ya puede ver. Se da al perfil
--   ESCUELAS (SOLO LECTURA) (5) de sramirez, para el reporte de colegios.
-- Es idempotente.

BEGIN;

INSERT INTO menu ("MenuId", "MenuNombre") VALUES
  ('operarcaja', 'OPERARCAJA'),
  ('reportestodascajas', 'REPORTESTODASCAJAS')
ON CONFLICT DO NOTHING;

INSERT INTO perfilmenu ("PerfilId", "MenuId", "puedeCrear", "puedeEditar", "puedeEliminar", "puedeLeer") VALUES
  (2, 'operarcaja', 1, 0, 0, 1),
  (5, 'reportestodascajas', 0, 0, 0, 1)
ON CONFLICT DO NOTHING;

COMMIT;

-- Control: usuarios activos no admin que quedarían sin poder operar caja
-- (hoy solo debería salir sramirez)
SELECT u."UsuarioId"
FROM usuario u
WHERE u."UsuarioIsAdmin" <> 'S' AND u."UsuarioEstado" = 'A'
  AND NOT EXISTS (
    SELECT 1 FROM usuarioperfil up
    JOIN perfilmenu pm ON pm."PerfilId" = up."PerfilId"
    WHERE up."UsuarioId" = u."UsuarioId" AND pm."MenuId" = 'operarcaja'
  );
