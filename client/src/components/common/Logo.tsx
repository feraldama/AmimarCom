import { useId } from "react";

interface LogoProps {
  /** Clases Tailwind para el tamaño de la insignia, ej. "size-12". */
  className?: string;
}

/**
 * Marca de Amimar: insignia con degradado de marca y una "A" geométrica
 * formada por un pico ascendente (sugiere crecimiento) más el travesaño.
 * Pensado para reutilizarse en login, sidebar y headers durante el rebrand.
 */
function Logo({ className = "size-12" }: LogoProps) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="Amimar"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradientId})`} />
      <path
        d="M14 34 L24 14 L34 34"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 27 H29.5"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Logo;
