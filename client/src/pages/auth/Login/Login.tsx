import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertTriangle, X } from "lucide-react";
import Logo from "../../../components/common/Logo";

interface Credentials {
  email: string;
  password: string;
}

function Login() {
  const [credentials, setCredentials] = useState<Credentials>({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(credentials);
      navigate("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message || "Credenciales incorrectas"
          : "Credenciales incorrectas"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh">
      {/* ───────────────── Panel de marca (desktop) ───────────────── */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex">
        {/* Formas decorativas */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-brand-400/20 blur-3xl"
        />

        {/* Logo + nombre */}
        <div className="relative flex items-center gap-3">
          <Logo className="size-12" />
          <span className="text-xl font-bold tracking-tight">Amimar</span>
        </div>

        {/* Mensaje principal */}
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Gestión financiera, clara y bajo control.
          </h1>
          <p className="mt-4 text-base text-white/70">
            Administrá cajas, cobros y pagos desde un solo lugar, con la
            precisión que tu negocio necesita.
          </p>
        </div>

        {/* Pie */}
        <p className="relative text-sm text-white/50">
          © 2026 Amimar. Todos los derechos reservados.
        </p>
      </aside>

      {/* ───────────────── Panel del formulario ───────────────── */}
      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="mx-auto flex w-full max-w-sm flex-col">
          {/* Logo móvil (panel de marca oculto en mobile) */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Logo className="size-14" />
            <span className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
              Amimar
            </span>
          </div>

          {/* Encabezado */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-gray-900">
              Bienvenido de vuelta
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Inicia sesión para acceder a tu cuenta
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 flex items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm"
            >
              <AlertTriangle
                className="size-5 flex-shrink-0 mt-0.5 text-danger-500"
                aria-hidden="true"
              />
              <span className="flex-1 text-danger-600">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Cerrar mensaje de error"
                className="text-danger-500 hover:text-danger-600 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Usuario
              </label>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="text"
                value={credentials.email}
                onChange={handleChange}
                required
                autoComplete="username"
                placeholder="Ingresa tu usuario"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                  placeholder:text-gray-400 focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-colors"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900
                    placeholder:text-gray-400 focus:ring-2 focus:ring-brand-300 focus:border-brand-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="size-[18px]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white
                transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-1
                ${
                  loading
                    ? "bg-brand-400 cursor-not-allowed"
                    : "bg-brand-600 hover:bg-brand-700 cursor-pointer"
                }`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white motion-reduce:animate-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Login;
