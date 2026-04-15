import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertTriangle, X } from "lucide-react";

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
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary-600 mb-4">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AMIMAR</h1>
          <p className="text-sm text-gray-500 mt-1">Inicia sesion en tu cuenta</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-card p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm">
              <AlertTriangle className="size-5 text-danger-500 flex-shrink-0 mt-0.5" />
              <span className="text-danger-600 flex-1">{error}</span>
              <button
                onClick={() => setError("")}
                className="text-danger-500 hover:text-danger-600 cursor-pointer"
              >
                <X className="size-4" />
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
                autoComplete="email"
                placeholder="Ingresa tu usuario"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
                  placeholder:text-gray-400 focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition-colors"
              />
            </div>

            {/* Contrasena */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Contrasena
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
                  placeholder="Ingresa tu contrasena"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900
                    placeholder:text-gray-400 focus:ring-2 focus:ring-primary-300 focus:border-primary-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" />
                  ) : (
                    <Eye className="size-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white
                transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-1
                ${loading
                  ? "bg-primary-400 cursor-not-allowed"
                  : "bg-primary-600 hover:bg-primary-700 cursor-pointer"
                }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
