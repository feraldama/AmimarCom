// Permiso que exige cada pantalla para abrirse (el mismo que verifica la
// página). Lo usan el Sidebar y el Dashboard para no mostrar accesos a
// pantallas que el usuario no puede usar. Rutas sin entrada: libres.

type Permisos = Record<
  string,
  { crear: boolean; editar: boolean; eliminar: boolean; leer: boolean }
>;

// Operar caja (aperturar/cerrar, cobrar): lo tienen los perfiles de cajeros
export const PERMISO_OPERAR_CAJA = "OPERARCAJA";

// Permisos específicos de cada reporte (ver ReportesPage)
export const PERMISOS_REPORTES = [
  "REPORTEINGRESOSEGRESOS",
  "REPORTEREGISTRODIARIO",
  "REPORTEPORCAJA",
  "REPORTECOLEGIOS",
  "REPORTEJSI",
  "REPORTEELCOMERCIO",
  "REPORTETRANSPORTE",
  "REPORTEWESTERN",
  "REPORTEWESTERNUSD",
  "REPORTEANTICIPOS",
  "REPORTECIERREDIARIO",
  "REPORTEDIVISAS",
  "REPORTEPASECAJAS",
  "REPORTEMOVIMIENTOSCAJAS",
];

// Alcanza con poder leer cualquiera de los menús listados
const MENUS_POR_RUTA: Record<string, string[]> = {
  "/ventas": [PERMISO_OPERAR_CAJA],
  "/apertura-cierre-caja": [PERMISO_OPERAR_CAJA],
  "/cierre-diario-historial": ["CIERREDIARIO"],
  "/customers": ["CLIENTES"],
  "/reportes": ["REPORTES", ...PERMISOS_REPORTES],
  "/movements/jsicobro": ["JSICOBRO"],
  "/movements/cajatipo": ["CAJATIPO"],
  "/movements/cajas": ["CAJAS"],
  "/movements/tiposgasto": ["TIPOSGASTO"],
  "/movements/summary": ["REGISTRODIARIOCAJA"],
  "/movements/pagoadmin": ["PAGOADMIN"],
  "/movements/western": ["WESTERNENVIO"],
  "/movements/transporte": ["TRANSPORTE"],
  "/pagotrans": ["PAGOTRANS"],
  "/movements/divisa": ["DIVISA"],
  "/movements/divisamovimiento": ["DIVISAMOVIMIENTO"],
  "/colegios": ["COLEGIO"],
  "/nominas": ["NOMINA"],
  "/colegiocobranzas": ["COLEGIOCOBRANZA"],
  "/horariouso": ["HORARIOUSO"],
  "/locales": ["LOCALES"],
  "/users": ["USUARIOS"],
  "/perfiles": ["PERFILES"],
  "/menus": ["MENUS"],
};

export function puedeAccederRuta(
  href: string,
  permisos: Permisos | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  const menus = MENUS_POR_RUTA[href];
  if (!menus) return true;
  return menus.some((m) => !!permisos?.[m]?.leer);
}
