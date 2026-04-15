import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/auth/Login/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import PrivateRoute from "./components/common/PrivateRoute";
import Layout from "./components/layout/Layout";
import NotFound from "./pages/NotFound";
import DocumentTitle from "./components/common/DocumentTitle";
import UsersPage from "./pages/users/UsersPage";
import MovementsPage from "./pages/movements/MovementsPage";
import CajasPage from "./pages/cajas/CajasPage";
import CajaTipoPage from "./pages/cajatipo/CajaTipoPage";
import TiposGastoPage from "./pages/tipogasto/TiposGastoPage";
import CustomersPage from "./pages/customers/CustomersPage";
import AperturaCierreCajaPage from "./pages/cajas/AperturaCierreCajaPage";
import Sales from "./pages/dashboard/Sales";
import LocalesPage from "./pages/locales/LocalesPage";
import AlmacenesPage from "./pages/almacenes/AlmacenesPage";
import CombosPage from "./pages/combos/CombosPage";
import PerfilesPage from "./pages/perfiles/PerfilesPage";
import MenusPage from "./pages/menus/MenusPage";
import HorarioUsoPage from "./pages/horariouso/HorarioUsoPage";
import ProductsPage from "./pages/products/ProductsPage";
import VentasPage from "./pages/ventas/VentasPage";
import CreditoPagosPage from "./pages/ventas/CreditoPagosPage";
import ReportesPage from "./pages/dashboard/ReportesPage";
import FacturasPage from "./pages/facturas/FacturasPage";
import Compras from "./pages/compras/Compras";
import ComprasPage from "./pages/compras/ComprasPage";
import TransportesPage from "./pages/transporte/TransportesPage";
import PagosTransportePage from "./pages/pagotrans/PagosTransportePage";
import ColegiosPage from "./pages/colegios/ColegiosPage";
import NominasPage from "./pages/nominas/NominasPage";
import ColegioCobranzasPage from "./pages/colegiocobranzas/ColegioCobranzasPage";
import DivisasPage from "./pages/divisa/DivisasPage";
import DivisasMovimientosPage from "./pages/divisamovimiento/DivisasMovimientosPage";
import JSICobroPage from "./pages/jsicobro/JSICobroPage";
import PagoAdminPage from "./pages/pagoadmin/PagoAdminPage";
import WesternEnvioPage from "./pages/westernenvio/WesternEnvioPage";

function App() {
  return (
    <Router>
      <DocumentTitle />
      <AuthProvider>
        <Routes>
          {/* Redirige la raíz / a /login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Rutas sin Layout (Sales y Compras) */}
          <Route
            path="/ventas"
            element={
              <PrivateRoute>
                <Sales />
              </PrivateRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <PrivateRoute>
                <Compras />
              </PrivateRoute>
            }
          />

          {/* Rutas privadas (con Layout que incluye Navbar) */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Agrega aquí más rutas protegidas */}
            <Route path="/users" element={<UsersPage />} />
            <Route path="/movements/summary" element={<MovementsPage />} />;
            <Route path="/movements/jsicobro" element={<JSICobroPage />} />
            <Route path="/movements/cajas" element={<CajasPage />} />;
            <Route path="/movements/cajatipo" element={<CajaTipoPage />} />;
            <Route path="/movements/tiposgasto" element={<TiposGastoPage />} />;
            <Route path="/movements/transporte" element={<TransportesPage />} />
            <Route path="/movements/divisa" element={<DivisasPage />} />
            <Route path="/movements/pagoadmin" element={<PagoAdminPage />} />
            <Route
              path="/movements/divisamovimiento"
              element={<DivisasMovimientosPage />}
            />
            <Route
              path="/movements/western"
              element={<WesternEnvioPage />}
            />
            <Route path="/pagotrans" element={<PagosTransportePage />} />
            <Route path="/colegios" element={<ColegiosPage />} />
            <Route path="/nominas" element={<NominasPage />} />
            <Route
              path="/colegiocobranzas"
              element={<ColegioCobranzasPage />}
            />
            <Route path="/customers" element={<CustomersPage />} />;
            <Route
              path="/apertura-cierre-caja"
              element={<AperturaCierreCajaPage />}
            />
            <Route path="/locales" element={<LocalesPage />} />
            <Route path="/almacenes" element={<AlmacenesPage />} />
            <Route path="/combos" element={<CombosPage />} />
            <Route path="/perfiles" element={<PerfilesPage />} />
            <Route path="/menus" element={<MenusPage />} />
            <Route path="/horariouso" element={<HorarioUsoPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/modifications/ventas" element={<VentasPage />} />
            <Route path="/modifications/compras" element={<ComprasPage />} />
            <Route path="/credito-pagos" element={<CreditoPagosPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/facturas" element={<FacturasPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
