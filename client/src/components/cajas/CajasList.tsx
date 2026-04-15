import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import CajaGastosList from "./CajaGastosList";
import { formatMiles, formatMilesWithDecimals } from "../../utils/utils";
import { getAllCajaTipos } from "../../services/cajatipo.service";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number | string;
  CajaGastoCantidad: number;
  CajaTipoId?: number | null;
  [key: string]: unknown;
}

interface CajaTipo {
  CajaTipoId: number;
  CajaTipoDescripcion: string;
}

interface Pagination {
  totalItems: number;
}

interface CajasListProps {
  cajas: Caja[];
  onDelete?: (item: Caja) => void;
  onEdit?: (item: Caja) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCaja?: Caja | null;
  onSubmit: (formData: Caja) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  cajaTipoId?: number | null;
  onCajaTipoFilter?: (tipoId: number | null) => void;
}

export default function CajasList({
  cajas,
  onDelete,
  onEdit,
  onCreate,
  pagination,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentCaja,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
  cajaTipoId,
  onCajaTipoFilter,
}: CajasListProps) {
  const [formData, setFormData] = useState({
    id: "",
    CajaId: "",
    CajaDescripcion: "",
    CajaMonto: 0,
    CajaGastoCantidad: 0,
    CajaTipoId: null as number | null,
  });
  const [cajaTipos, setCajaTipos] = useState<CajaTipo[]>([]);

  useEffect(() => {
    const loadCajaTipos = async () => {
      try {
        const tipos = await getAllCajaTipos();
        setCajaTipos(tipos);
      } catch (error) {
        console.error("Error al cargar tipos de caja:", error);
      }
    };
    loadCajaTipos();
  }, []);

  useEffect(() => {
    if (currentCaja) {
      // Convertir CajaMonto igual que en la tabla: Number() maneja correctamente strings con punto decimal
      const monto = Number(currentCaja.CajaMonto);
      setFormData({
        id: String(currentCaja.id ?? currentCaja.CajaId),
        CajaId: String(currentCaja.CajaId),
        CajaDescripcion: currentCaja.CajaDescripcion,
        CajaMonto: monto,
        CajaGastoCantidad: currentCaja.CajaGastoCantidad,
        CajaTipoId: currentCaja.CajaTipoId || null,
      });
    } else {
      setFormData({
        id: "",
        CajaId: "",
        CajaDescripcion: "",
        CajaMonto: 0,
        CajaGastoCantidad: 0,
        CajaTipoId: null,
      });
    }
  }, [currentCaja]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "CajaMonto" || name === "CajaGastoCantidad"
          ? Number(value)
          : name === "CajaTipoId"
          ? value === "" || value === "null"
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.CajaTipoId) {
      alert("Debe seleccionar un tipo de caja");
      return;
    }
    onSubmit(formData);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseModal();
    }
  };

  const columns = [
    { key: "CajaId", label: "ID" },
    { key: "CajaDescripcion", label: "Descripción" },
    {
      key: "CajaMonto",
      label: "Monto",
      render: (caja: Caja) => {
        // Si CajaTipoId === 3, mostrar con decimales
        // Si es distinto a 3, mostrar con formato de miles
        const monto = Number(caja.CajaMonto);
        if (caja.CajaTipoId === 3) {
          return `Gs. ${formatMilesWithDecimals(monto)}`;
        }
        return `Gs. ${formatMiles(monto)}`;
      },
    },
    {
      key: "CajaTipoId",
      label: "Tipo de Caja",
      render: (caja: Caja) => {
        const tipo = cajaTipos.find((t) => t.CajaTipoId === caja.CajaTipoId);
        return tipo ? tipo.CajaTipoDescripcion : "-";
      },
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar cajas"
          />
        </div>
        {onCajaTipoFilter && (
          <div className="flex items-center gap-2">
            <select
              value={cajaTipoId || ""}
              onChange={(e) => {
                const value = e.target.value;
                onCajaTipoFilter(value === "" ? null : Number(value));
              }}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block p-2.5 h-[42px]"
            >
              <option value="">Todos los tipos</option>
              {cajaTipos
                .sort((a, b) =>
                  a.CajaTipoDescripcion.localeCompare(
                    b.CajaTipoDescripcion
                  )
                )
                .map((tipo) => (
                  <option key={tipo.CajaTipoId} value={tipo.CajaTipoId}>
                    {tipo.CajaTipoDescripcion}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nueva Caja"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Caja>
        columns={columns}
        data={cajas}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron cajas"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleBackdropClick}
        >
          <div className="absolute inset-0 bg-black opacity-50" />
          <div className="relative w-full max-w-2xl max-h-full z-10">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentCaja
                    ? `Editar caja: ${currentCaja.CajaId}`
                    : "Crear nueva caja"}
                </h3>
                <button
                  type="button"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center"
                  onClick={onCloseModal}
                >
                  <svg
                    className="size-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="CajaDescripcion"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Descripción
                    </label>
                    <input
                      type="text"
                      name="CajaDescripcion"
                      id="CajaDescripcion"
                      value={formData.CajaDescripcion}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "CajaDescripcion",
                            value: value,
                          },
                        } as React.ChangeEvent<HTMLInputElement>);
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="CajaMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto
                    </label>
                    <input
                      type="text"
                      name="CajaMonto"
                      id="CajaMonto"
                      value={
                        formData.CajaMonto !== undefined &&
                        formData.CajaMonto !== null
                          ? formData.CajaTipoId === 3
                            ? formatMilesWithDecimals(formData.CajaMonto)
                            : formatMiles(formData.CajaMonto)
                          : "0"
                      }
                      onChange={(e) => {
                        let raw = e.target.value
                          .replace(/\s/g, "")
                          .replace(/\./g, ""); // Eliminar puntos de miles
                        // Manejar signo negativo
                        const isNegative = raw.startsWith("-");
                        if (isNegative) {
                          raw = raw.substring(1);
                        }
                        // Reemplazar coma por punto para parseFloat (el backend usa punto como decimal)
                        raw = raw.replace(/,/g, ".");
                        const num = parseFloat(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            CajaMonto: isNegative ? -num : num,
                          }));
                        } else if (raw === "" || raw === "-") {
                          setFormData((prev) => ({ ...prev, CajaMonto: 0 }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="CajaTipoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo de Caja <span className="text-destructive">*</span>
                    </label>
                    <select
                      name="CajaTipoId"
                      id="CajaTipoId"
                      value={formData.CajaTipoId || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    >
                      <option value="">Seleccione un tipo</option>
                      {cajaTipos
                        .sort((a, b) =>
                          a.CajaTipoDescripcion.localeCompare(
                            b.CajaTipoDescripcion
                          )
                        )
                        .map((tipo) => (
                          <option key={tipo.CajaTipoId} value={tipo.CajaTipoId}>
                            {tipo.CajaTipoDescripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                {/* Detalle: gastos de la caja */}
                {currentCaja && (
                  <div className="mt-8">
                    <h4 className="text-lg font-semibold mb-2">
                      Gastos asignados a la caja
                    </h4>
                    <CajaGastosList cajaId={currentCaja.CajaId} />
                  </div>
                )}
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentCaja ? "Actualizar" : "Crear"}
                  type="submit"
                />
                <ActionButton
                  label="Cancelar"
                  variant="secondary"
                  onClick={onCloseModal}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
