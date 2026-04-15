import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";

interface HorarioUso {
  id: string | number;
  HorarioUsoId: string | number;
  HorarioUsoDesde: string;
  HorarioUsoHasta: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
}

interface HorarioUsoListProps {
  horarios: HorarioUso[];
  onDelete?: (item: HorarioUso) => void;
  onEdit?: (item: HorarioUso) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentHorario?: HorarioUso | null;
  onSubmit: (formData: HorarioUso) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function HorarioUsoList({
  horarios,
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
  currentHorario,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: HorarioUsoListProps) {
  const [formData, setFormData] = useState({
    id: "",
    HorarioUsoId: "",
    HorarioUsoDesde: "",
    HorarioUsoHasta: "",
  });

  useEffect(() => {
    if (currentHorario) {
      // Extraer solo la hora (HH:mm) del DATETIME
      const desde = currentHorario.HorarioUsoDesde
        ? new Date(currentHorario.HorarioUsoDesde).toTimeString().slice(0, 5)
        : "";
      const hasta = currentHorario.HorarioUsoHasta
        ? new Date(currentHorario.HorarioUsoHasta).toTimeString().slice(0, 5)
        : "";
      setFormData({
        id: String(currentHorario.id ?? currentHorario.HorarioUsoId),
        HorarioUsoId: String(currentHorario.HorarioUsoId),
        HorarioUsoDesde: desde,
        HorarioUsoHasta: hasta,
      });
    } else {
      // Inicializar con hora actual
      const ahora = new Date();
      const hh = String(ahora.getHours()).padStart(2, "0");
      const min = String(ahora.getMinutes()).padStart(2, "0");
      const hora = `${hh}:${min}`;
      setFormData({
        id: "",
        HorarioUsoId: "",
        HorarioUsoDesde: hora,
        HorarioUsoHasta: hora,
      });
    }
  }, [currentHorario]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Construir DATETIME completo usando la fecha actual y la hora seleccionada
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    
    const horarioData = {
      ...formData,
      HorarioUsoDesde: `${fecha} ${formData.HorarioUsoDesde}:00`,
      HorarioUsoHasta: `${fecha} ${formData.HorarioUsoHasta}:00`,
    };
    
    onSubmit(horarioData);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseModal();
    }
  };

  // Formatear para mostrar solo la hora en la tabla
  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    { key: "HorarioUsoId", label: "ID" },
    {
      key: "HorarioUsoDesde",
      label: "Desde",
      render: (horario: HorarioUso) => formatTime(horario.HorarioUsoDesde),
    },
    {
      key: "HorarioUsoHasta",
      label: "Hasta",
      render: (horario: HorarioUso) => formatTime(horario.HorarioUsoHasta),
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
            placeholder="Buscar horarios"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Horario"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<HorarioUso>
        columns={columns}
        data={horarios}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron horarios"
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
                  {currentHorario
                    ? `Editar horario: ${currentHorario.HorarioUsoId}`
                    : "Crear nuevo horario"}
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
                      htmlFor="HorarioUsoDesde"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Desde <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="time"
                      name="HorarioUsoDesde"
                      id="HorarioUsoDesde"
                      value={formData.HorarioUsoDesde}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="HorarioUsoHasta"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Hasta <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="time"
                      name="HorarioUsoHasta"
                      id="HorarioUsoHasta"
                      value={formData.HorarioUsoHasta}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentHorario ? "Actualizar" : "Crear"}
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
