import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEstadoAperturaPorUsuario } from "../../services/registrodiariocaja.service";
import { getCajaById } from "../../services/cajas.service";
import { getLocalById } from "../../services/locales.service";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  LockOpen,
  User,
  MapPin,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import PagoTab from "./tabs/PagoTab";
import WesternPagosTab from "./tabs/WesternPagosTab";
import PaseCajasTab from "./tabs/PaseCajasTab";
import CobranzaColegiosTab from "./tabs/CobranzaColegiosTab";
import EmpresasTransporteTab from "./tabs/EmpresasTransporteTab";
import DivisasTab from "./tabs/DivisasTab";
import JuntaSaneamientoTab from "./tabs/JuntaSaneamientoTab";
import CobranzaTab from "./tabs/CobranzaTab";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  [key: string]: unknown;
}

const tabs = [
  { id: "cobranza", label: "Cobranza", component: CobranzaTab },
  { id: "western-pagos", label: "Western", component: WesternPagosTab },
  { id: "pase-cajas", label: "Pase de Cajas", component: PaseCajasTab },
  { id: "cobranza-colegios", label: "Colegios", component: CobranzaColegiosTab },
  { id: "empresas-transporte", label: "Transporte", component: EmpresasTransporteTab },
  { id: "divisas", label: "Divisas", component: DivisasTab },
  { id: "junta-saneamiento", label: "JSI", component: JuntaSaneamientoTab },
  { id: "pago", label: "Pago", component: PagoTab },
];

export default function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("sales-active-tab") || "cobranza"
  );
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [localNombre, setLocalNombre] = useState("");

  useEffect(() => {
    localStorage.setItem("sales-active-tab", activeTab);
  }, [activeTab]);

  // Check scroll state
  const checkScroll = () => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scrollTabs = (dir: "left" | "right") => {
    tabsRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  // Fetch caja info
  useEffect(() => {
    const fetchCaja = async () => {
      if (!user?.id) return;
      try {
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
        } else {
          setCajaAperturada(null);
          await Swal.fire({
            icon: "warning",
            title: "Caja no aperturada",
            text: "Debes aperturar una caja antes de realizar cobros.",
            confirmButtonText: "Ir a aperturar caja",
            confirmButtonColor: "#4f46e5",
          });
          navigate("/apertura-cierre-caja");
        }
      } catch {
        setCajaAperturada(null);
        await Swal.fire({
          icon: "warning",
          title: "Caja no aperturada",
          text: "Debes aperturar una caja antes de realizar cobros.",
          confirmButtonText: "Ir a aperturar caja",
          confirmButtonColor: "#4f46e5",
        });
        navigate("/apertura-cierre-caja");
      }
    };
    fetchCaja();
  }, [user, navigate]);

  useEffect(() => {
    if (user?.LocalId) {
      getLocalById(user.LocalId)
        .then((data) => setLocalNombre(data.LocalNombre || ""))
        .catch(() => setLocalNombre(""));
    } else {
      setLocalNombre("");
    }
  }, [user?.LocalId]);

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || CobranzaTab;

  return (
    <div className="min-h-screen bg-page-bg p-3 sm:p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-card border border-border p-4">
        {/* Top row: back + title + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="size-9 flex-shrink-0"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">
              Registrar Cobros / Pagos
            </h1>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate("/apertura-cierre-caja")}
          >
            <LockOpen className="size-4" />
            <span className="hidden sm:inline">Apertura/Cierre</span>
          </Button>
        </div>

        {/* Info badges */}
        {user && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <User className="size-3" />
              {user.nombre}
              <span className="text-muted-foreground">({user.id})</span>
            </Badge>
            {localNombre && (
              <Badge variant="outline" className="gap-1.5 font-normal">
                <MapPin className="size-3" />
                {localNombre}
              </Badge>
            )}
            {cajaAperturada && (
              <Badge variant="default" className="gap-1.5 font-normal">
                <Wallet className="size-3" />
                {cajaAperturada.CajaDescripcion}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Tabs + Content */}
      <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden flex-1 flex flex-col">
        {/* Tab navigation */}
        <div className="relative border-b border-border bg-muted/30 flex-shrink-0">
          {/* Scroll indicators */}
          {canScrollLeft && (
            <button
              onClick={() => scrollTabs("left")}
              className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-white to-transparent flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scrollTabs("right")}
              className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white to-transparent flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          )}

          <div
            ref={tabsRef}
            onScroll={checkScroll}
            className="flex overflow-x-auto scrollbar-none px-2 py-2 gap-1"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer
                    ${isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 flex-1 overflow-y-auto">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
