import { useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Input de fecha donde el tabulador salta directo al ícono de calendario, sin
 * detenerse en los segmentos día/mes/año.
 *
 * Para lograrlo, el input nativo se saca del orden de tabulación
 * (tabIndex={-1}, así sus segmentos internos dejan de ser paradas del
 * tabulador) y se oculta su ícono nativo. En su lugar se muestra un botón
 * propio que sí es tabulable y que abre el selector con showPicker() solo
 * cuando el usuario lo activa (Enter/Espacio o clic). Igual se puede escribir
 * la fecha a mano haciendo clic sobre el campo.
 *
 * Es un reemplazo directo de <input type="date" | "datetime-local">: acepta las
 * mismas props (value, onChange por evento, name, id, required, min, max,
 * disabled, className, etc.).
 *
 * USAR ESTE COMPONENTE para todo nuevo campo de fecha del sistema, en lugar de
 * un <input type="date"> nativo, para mantener el comportamiento uniforme.
 */
type CampoFechaProps = Omit<ComponentProps<"input">, "type"> & {
  type?: "date" | "datetime-local";
};

export default function CampoFecha({
  type = "date",
  className,
  disabled,
  ...props
}: CampoFechaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const abrirCalendario = () => {
    try {
      inputRef.current?.showPicker?.();
    } catch {
      /* showPicker no disponible o sin activación del usuario */
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={type}
        disabled={disabled}
        tabIndex={-1}
        className={cn(
          "pr-10 [&::-webkit-calendar-picker-indicator]:hidden",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        disabled={disabled}
        aria-label="Abrir calendario"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
          />
        </svg>
      </button>
    </div>
  );
}
