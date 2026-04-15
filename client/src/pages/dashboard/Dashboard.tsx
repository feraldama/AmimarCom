import { useAuth } from "../../contexts/useAuth";
import { Link } from "react-router-dom";
import {
  Users as UserGroupIcon,
  FileBarChart,
  DollarSign,
  Lock,
  Users,
  BarChart3,
  TrendingUp,
  Clock,
} from "lucide-react";
import { formatMiles } from "../../utils/utils";

interface QuickActionProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function QuickAction({ to, icon, title, description, color }: QuickActionProps) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-card
        hover:shadow-card-hover hover:border-gray-200 transition-all duration-200 no-underline group`}
    >
      <div className={`flex-shrink-0 p-3 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-800 group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon, value, label, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 tabular-nums ${color}`}>
            {formatMiles(value)}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`} aria-hidden="true">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-gray-500 mt-1">
          Bienvenido, <span className="text-primary font-medium">{user?.nombre}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="size-6 text-primary" />}
          value={24}
          label="Usuarios totales"
          color="text-primary"
          bgColor="bg-primary-50/60"
        />
        <StatCard
          icon={<TrendingUp className="size-6 text-success-600" />}
          value={109}
          label="Registros diarios"
          color="text-success-600"
          bgColor="bg-success-50"
        />
        <StatCard
          icon={<UserGroupIcon className="size-6 text-warning-600" />}
          value={9454}
          label="Clientes"
          color="text-warning-600"
          bgColor="bg-warning-50"
        />
        <StatCard
          icon={<Clock className="size-6 text-gray-600" />}
          value={48}
          label="Cajas registradas"
          color="text-gray-700"
          bgColor="bg-gray-100"
        />
      </div>

      {/* Acciones rapidas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Acciones rapidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickAction
            to="/ventas"
            icon={<DollarSign className="size-6 text-success-600" />}
            title="Cobranzas"
            description="Realizar cobros y pagos"
            color="bg-success-50"
          />
          <QuickAction
            to="/apertura-cierre-caja"
            icon={<Lock className="size-6 text-primary" />}
            title="Apertura / Cierre de Caja"
            description="Gestionar cajas del día"
            color="bg-primary-50/60"
          />
          <QuickAction
            to="/customers"
            icon={<Users className="size-6 text-warning-600" />}
            title="Clientes"
            description="Administrar clientes"
            color="bg-warning-50"
          />
          <QuickAction
            to="/reportes"
            icon={<FileBarChart className="size-6 text-primary" />}
            title="Reportes"
            description="Generar reportes PDF"
            color="bg-primary-50/60"
          />
          <QuickAction
            to="/users"
            icon={<UserGroupIcon className="size-6 text-gray-600" />}
            title="Usuarios"
            description="Gestión de usuarios"
            color="bg-gray-100"
          />
          <QuickAction
            to="/movements/summary"
            icon={<BarChart3 className="size-6 text-success-600" />}
            title="Registro Diario"
            description="Ver movimientos de caja"
            color="bg-success-50"
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
