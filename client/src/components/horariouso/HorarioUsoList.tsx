import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

interface HorarioUso {
  id: string | number;
  HorarioUsoId: string | number;
  HorarioUsoDesde: string;
  HorarioUsoHasta: string;
  [key: string]: unknown;
}


interface HorarioUsoListProps {
  horarios: HorarioUso[];
  onDelete?: (item: HorarioUso) => void;
  onEdit?: (item: HorarioUso) => void;
  onCreate?: () => void;
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

  const formId = "horario-form";

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
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentHorario
            ? `Editar horario: ${currentHorario.HorarioUsoId}`
            : "Crear nuevo horario"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentHorario ? "Actualizar" : "Crear"}
              type="submit"
              form={formId}
            />
            <ActionButton
              label="Cancelar"
              variant="secondary"
              onClick={onCloseModal}
            />
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-6">
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
        </form>
      </Modal>
    </>
  );
}
