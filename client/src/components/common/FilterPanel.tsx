import type { ReactNode } from "react";
import CampoFecha from "./CampoFecha";
import ActionButton from "./Button/ActionButton";

interface FilterPanelProps {
  /** Valor del campo "Desde" (YYYY-MM-DD). Omitir desactiva el rango de fechas. */
  fechaDesde?: string;
  /** Valor del campo "Hasta" (YYYY-MM-DD). */
  fechaHasta?: string;
  onFechaDesdeChange?: (value: string) => void;
  onFechaHastaChange?: (value: string) => void;
  /** Selects u otros controles de filtro adicionales. */
  children?: ReactNode;
  onApply: () => void;
  onClear: () => void;
  /** Muestra el rango de fechas (por defecto true). */
  showFechas?: boolean;
}

/**
 * Barra de filtros estándar del proyecto: rango de fechas (Desde/Hasta) con
 * CampoFecha, selects adicionales pasados como children y botones
 * "Filtrar"/"Limpiar". El componente es controlado: el padre maneja el estado
 * de los inputs y el estado "aplicado".
 */
export default function FilterPanel({
  fechaDesde = "",
  fechaHasta = "",
  onFechaDesdeChange,
  onFechaHastaChange,
  children,
  onApply,
  onClear,
  showFechas = true,
}: FilterPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {showFechas && (
          <>
            <div className="flex-1 min-w-[140px]">
              <label
                htmlFor="filtroFechaDesde"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Desde
              </label>
              <CampoFecha
                id="filtroFechaDesde"
                type="date"
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={(e) => onFechaDesdeChange?.(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label
                htmlFor="filtroFechaHasta"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Hasta
              </label>
              <CampoFecha
                id="filtroFechaHasta"
                type="date"
                value={fechaHasta}
                min={fechaDesde || undefined}
                onChange={(e) => onFechaHastaChange?.(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
          </>
        )}

        {children}

        <div className="flex gap-2">
          <ActionButton label="Filtrar" onClick={onApply} />
          <ActionButton label="Limpiar" variant="secondary" onClick={onClear} />
        </div>
      </div>
    </div>
  );
}

interface FilterSelectOption {
  value: string | number;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  /** Texto de la opción vacía (por defecto "Todos"). */
  placeholder?: string;
  id?: string;
}

/** Select de filtro con el estilo estándar, para usar dentro de FilterPanel. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Todos",
  id,
}: FilterSelectProps) {
  const selectId = id || `filtro-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex-1 min-w-[160px]">
      <label
        htmlFor={selectId}
        className="block text-xs font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
