import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { puedeAccederRuta } from "../../utils/accesoRutas";

// Envuelve una ruta cuya página no verifica permisos por sí misma: solo la
// muestra si el usuario puede acceder a `ruta` (ver utils/accesoRutas).
export default function RequierePermiso({
  ruta,
  children,
}: {
  ruta: string;
  children: ReactNode;
}) {
  const { user, permisos } = useAuth();
  if (puedeAccederRuta(ruta, permisos, user?.isAdmin === "S")) {
    return <>{children}</>;
  }
  return (
    <div className="p-6">
      <p>No tienes permiso para acceder a esta pantalla.</p>
      <Link to="/dashboard" className="text-primary underline">
        Volver al inicio
      </Link>
    </div>
  );
}
