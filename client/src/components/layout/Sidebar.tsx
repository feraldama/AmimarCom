import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import {
  X,
  ChevronDown,
  ChevronRight,
  Home,
  KeyRound,
  Users,
  PenSquare,
  Banknote,
  DollarSign,
  Lock,
  BarChart3,
  Truck,
  GraduationCap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

interface NavigationChild {
  name: string;
  href: string;
  children?: NavigationChild[];
}

interface NavigationItem extends NavigationChild {
  icon?: React.ReactNode;
}

const navigation: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: <Home className="size-5" />,
  },
  {
    name: "Apertura/Cierre de Caja",
    href: "/apertura-cierre-caja",
    icon: <Lock className="size-5" />,
  },
  {
    name: "Cobranzas",
    href: "/ventas",
    icon: <DollarSign className="size-5" />,
  },
  {
    name: "Clientes",
    href: "/customers",
    icon: <Users className="size-5" />,
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: <BarChart3 className="size-5" />,
  },
  {
    name: "Registro Diario",
    href: "/movements",
    icon: <PenSquare className="size-5" />,
    children: [
      { name: "Cobros JSI", href: "/movements/jsicobro" },
      { name: "Tipos de Caja", href: "/movements/cajatipo" },
      { name: "Cajas", href: "/movements/cajas" },
      { name: "Tipos de Gasto", href: "/movements/tiposgasto" },
      { name: "Registro Diario Caja", href: "/movements/summary" },
      { name: "Pagos Admin", href: "/movements/pagoadmin" },
      { name: "Western", href: "/movements/western" },
    ],
  },
  {
    name: "Transporte",
    href: "/transporte",
    icon: <Truck className="size-5" />,
    children: [
      { name: "Empresas de Transporte", href: "/movements/transporte" },
      { name: "Pagos Transporte", href: "/pagotrans" },
    ],
  },
  {
    name: "Divisas",
    href: "/divisa",
    icon: <Banknote className="size-5" />,
    children: [
      { name: "Divisas", href: "/movements/divisa" },
      { name: "Movimientos", href: "/movements/divisamovimiento" },
    ],
  },
  {
    name: "Admin. Colegios",
    href: "/admincolegios",
    icon: <GraduationCap className="size-5" />,
    children: [
      { name: "Colegios", href: "/colegios" },
      { name: "Nominas", href: "/nominas" },
      { name: "Cobranzas", href: "/colegiocobranzas" },
    ],
  },
  {
    name: "Control de Acceso",
    href: "/access-control",
    icon: <KeyRound className="size-5" />,
    children: [
      { name: "Horarios de Uso", href: "/horariouso" },
      { name: "Locales", href: "/locales" },
      { name: "Usuarios", href: "/users" },
      { name: "Perfiles", href: "/perfiles" },
      { name: "Menus", href: "/menus" },
    ],
  },
];

interface NavItemProps {
  item: NavigationItem;
  level?: number;
  onNavigate?: () => void;
}

function NavItem({ item, level = 0, onNavigate }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  const hasActiveChild = item.children?.some(
    (child) => location.pathname === child.href
  );

  if (item.children) {
    return (
      <Disclosure as="div" defaultOpen={isActive || hasActiveChild}>
        {({ open }) => (
          <>
            <DisclosureButton
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
                ${hasActiveChild
                  ? "text-white bg-sidebar-hover"
                  : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-200"
                }`}
              style={{ paddingLeft: `${level * 16 + 12}px` }}
            >
              {level === 0 && item.icon && (
                <span className="mr-3 flex-shrink-0">{item.icon}</span>
              )}
              <span className="flex-1 text-left">{item.name}</span>
              {open ? (
                <ChevronDown className="size-4 text-slate-500" />
              ) : (
                <ChevronRight className="size-4 text-slate-500" />
              )}
            </DisclosureButton>
            <DisclosurePanel as="ul" className="mt-0.5 space-y-0.5">
              {item.children!.map((child) => (
                <li key={child.name}>
                  <NavItem item={child} level={level + 1} onNavigate={onNavigate} />
                </li>
              ))}
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
    );
  }

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
        ${isActive
          ? "bg-sidebar-active text-white"
          : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-200"
        }`}
      style={{ paddingLeft: `${level * 16 + (level === 0 ? 12 : 28)}px` }}
    >
      {level === 0 && item.icon && (
        <span className="mr-3 flex-shrink-0">{item.icon}</span>
      )}
      {item.name}
    </Link>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const sidebarContent = (
    <nav className="px-3 py-4 space-y-1">
      {navigation.map((item) => (
        <NavItem
          key={item.name}
          item={item}
          onNavigate={() => setMobileOpen(false)}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col bg-sidebar">
          <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
            <span className="text-white font-bold text-lg tracking-wide">AMIMAR</span>
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-sidebar-hover transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 lg:flex lg:flex-col bg-sidebar"
        style={{ top: "56px", height: "calc(100vh - 56px)" }}
      >
        <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
      </div>
    </>
  );
}
