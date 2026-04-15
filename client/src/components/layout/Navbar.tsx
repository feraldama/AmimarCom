import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { Menu as MenuIcon, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { Link, useNavigate, useLocation } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

interface NavbarProps {
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
}

const quickLinks = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Apertura de caja", href: "/apertura-cierre-caja" },
  { name: "Cobranzas", href: "/ventas" },
];

export default function Navbar({ setMobileOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-30 bg-sidebar border-b border-white/10">
      <div className="px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Izquierda: hamburger + logo + links */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-sidebar-hover transition-colors lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="size-6" />
            </button>

            <Link to="/dashboard" className="text-white font-bold text-lg tracking-wide hidden lg:block">
              AMIMAR
            </Link>

            <div className="hidden sm:flex items-center gap-1 ml-4">
              {quickLinks.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${isActive
                        ? "bg-sidebar-active text-white"
                        : "text-slate-400 hover:bg-sidebar-hover hover:text-white"
                      }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Derecha: usuario */}
          <Menu as="div" className="relative">
            <MenuButton className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-sidebar-hover transition-colors cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                {user?.nombre?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <span className="hidden sm:block text-white text-sm">
                {user?.nombre ?? "Usuario"}
              </span>
            </MenuButton>

            <MenuItems
              transition
              className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none"
            >
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <MenuItem>
                {({ focus }) => (
                  <button
                    onClick={handleLogout}
                    className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 cursor-pointer
                      ${focus ? "bg-gray-50" : ""}`}
                  >
                    <LogOut className="size-4" />
                    Cerrar sesion
                  </button>
                )}
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </nav>
  );
}
