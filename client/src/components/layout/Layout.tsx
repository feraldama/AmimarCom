import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60]
          focus:rounded-md focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium
          focus:text-white focus:shadow-lg focus:ring-2 focus:ring-primary-300 focus:outline-none"
      >
        Saltar al contenido principal
      </a>

      <div className="flex-shrink-0">
        <Navbar setMobileOpen={setMobileOpen} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-page-bg p-4 sm:p-6 lg:ml-64 focus:outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
