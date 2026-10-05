import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Las pantallas (sobre todo Cobranzas) quedan abiertas todo el día y siguen
// corriendo el build con el que se abrieron. Cada tanto (y al volver a la
// pestaña) se compara el bundle que referencia el index.html del servidor
// con el que está cargado; si hay un deploy nuevo se avisa para recargar.
// No se recarga solo para no perder un cobro a medio cargar.

const INTERVALO_MS = 5 * 60 * 1000;
const PATRON_BUNDLE = /\/assets\/index-[\w-]+\.js/;

const bundleCargado = (): string | null => {
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]'
  );
  return script?.src.match(PATRON_BUNDLE)?.[0] ?? null;
};

export default function AvisoNuevaVersion() {
  const [hayNueva, setHayNueva] = useState(false);

  useEffect(() => {
    const actual = bundleCargado();
    if (!import.meta.env.PROD || !actual) return;

    let cancelado = false;
    const verificar = async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        if (!res.ok) return;
        const servidor = (await res.text()).match(PATRON_BUNDLE)?.[0];
        if (!cancelado && servidor && servidor !== actual) setHayNueva(true);
      } catch {
        // Sin conexión: se reintenta en el próximo ciclo
      }
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") verificar();
    };

    const id = window.setInterval(verificar, INTERVALO_MS);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  if (!hayNueva) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-lg bg-amber-500 px-4 py-3 text-white shadow-lg"
    >
      <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium">
        Hay una versión nueva del sistema. Terminá lo que estás cargando y
        actualizá.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
      >
        Actualizar
      </button>
    </div>
  );
}
