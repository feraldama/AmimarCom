import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Mapeo de rutas a títulos de página
const routeTitles: Record<string, string> = {
  "/login": "Iniciar Sesión",
  "/dashboard": "Dashboard",
  "/users": "Usuarios",
  "/movements/summary": "Registro Diario Caja",
  "/movements/jsicobro": "Cobros JSI",
  "/movements/cajas": "Cajas",
  "/movements/cajatipo": "Tipos de Caja",
  "/movements/tiposgasto": "Tipos de Gasto",
  "/movements/transporte": "Empresas de Transporte",
  "/movements/divisa": "Divisas",
  "/movements/pagoadmin": "Pagos Admin",
  "/movements/divisamovimiento": "Movimientos de Divisas",
  "/movements/western": "Western",
  "/pagotrans": "Pagos Transporte",
  "/colegios": "Colegios",
  "/nominas": "Nominas",
  "/colegiocobranzas": "Cobranzas de Colegios",
  "/customers": "Clientes",
  "/apertura-cierre-caja": "Apertura/Cierre de Caja",
  "/locales": "Locales",
  "/almacenes": "Almacenes",
  "/combos": "Combos",
  "/perfiles": "Perfiles",
  "/menus": "Menús",
  "/horariouso": "Horarios de Uso",
  "/products": "Productos",
  "/modifications/ventas": "Ventas",
  "/modifications/compras": "Compras",
  "/credito-pagos": "Cobro de Créditos",
  "/reportes": "Reportes",
  "/facturas": "Facturas",
  "/ventas": "Cobranzas",
  "/compras": "Compras",
};

const DEFAULT_TITLE = "Amimar";

/**
 * Componente que actualiza el título del documento según la ruta actual
 */
export default function DocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = routeTitles[location.pathname] || "Página no encontrada";
    document.title = pageTitle ? `${DEFAULT_TITLE} - ${pageTitle}` : DEFAULT_TITLE;
  }, [location.pathname]);

  return null;
}
