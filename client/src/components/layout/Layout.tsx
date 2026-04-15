import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const fullscreen = location.pathname === "/ventas";

  if (fullscreen) {
    return (
      <div className="h-screen font-sans">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans">
      <div className="flex-shrink-0">
        <Navbar setMobileOpen={setMobileOpen} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <main className="flex-1 overflow-y-auto bg-page-bg p-4 sm:p-6 lg:ml-64">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
