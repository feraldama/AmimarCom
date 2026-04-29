import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import { getColegios } from "../../services/colegio.service";
import { getColegioCursos } from "../../services/colegio.service";

interface Nomina {
  id: string | number;
  NominaId: string | number;
  NominaNombre: string;
  NominaApellido: string;
  ColegioId: string | number;
  ColegioCursoId: string | number;
  ColegioNombre?: string;
  ColegioCursoNombre?: string;
  [key: string]: unknown;
}

interface Colegio {
  ColegioId: number;
  ColegioNombre: string;
}

interface ColegioCurso {
  ColegioId: number;
  ColegioCursoId: number;
  ColegioCursoNombre: string;
}


interface NominasListProps {
  nominas: Nomina[];
  onDelete?: (item: Nomina) => void;
  onEdit?: (item: Nomina) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentNomina?: Nomina | null;
  onSubmit: (formData: Nomina) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function NominasList({
  nominas,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentNomina,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: NominasListProps) {
  const [formData, setFormData] = useState({
    id: "",
    NominaId: "",
    NominaNombre: "",
    NominaApellido: "",
    ColegioId: "",
    ColegioCursoId: "",
  });

  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [cursos, setCursos] = useState<ColegioCurso[]>([]);

  useEffect(() => {
    const fetchColegios = async () => {
      try {
        const data = await getColegios(1, 1000); // Obtener todos los colegios
        setColegios(data.data || []);
      } catch (error) {
        console.error("Error al cargar colegios:", error);
      }
    };
    fetchColegios();
  }, []);

  useEffect(() => {
    if (currentNomina) {
      setFormData({
        id: String(currentNomina.id ?? currentNomina.NominaId),
        NominaId: String(currentNomina.NominaId),
        NominaNombre: currentNomina.NominaNombre || "",
        NominaApellido: currentNomina.NominaApellido || "",
        ColegioId: currentNomina.ColegioId
          ? String(currentNomina.ColegioId)
          : "",
        ColegioCursoId: currentNomina.ColegioCursoId
          ? String(currentNomina.ColegioCursoId)
          : "",
      });
      // Cargar cursos del colegio seleccionado
      if (currentNomina.ColegioId) {
        loadCursos(currentNomina.ColegioId);
      }
    } else {
      setFormData({
        id: "",
        NominaId: "",
        NominaNombre: "",
        NominaApellido: "",
        ColegioId: "",
        ColegioCursoId: "",
      });
      setCursos([]);
    }
  }, [currentNomina]);

  const loadCursos = async (colegioId: string | number) => {
    try {
      const data = await getColegioCursos(colegioId);
      setCursos(data || []);
    } catch (error) {
      console.error("Error al cargar cursos:", error);
      setCursos([]);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "ColegioId") {
      // Reset curso cuando cambia colegio
      setFormData((prev) => ({
        ...prev,
        ColegioId: value,
        ColegioCursoId: "",
      }));
      // Cargar cursos del colegio seleccionado
      if (value) {
        loadCursos(value);
      } else {
        setCursos([]);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dataToSubmit: Partial<Nomina> = {
      id: formData.id,
      NominaId: formData.NominaId,
      NominaNombre: formData.NominaNombre,
      NominaApellido: formData.NominaApellido,
      ColegioId: formData.ColegioId,
      ColegioCursoId: formData.ColegioCursoId,
    };
    onSubmit(dataToSubmit as Nomina);
  };

  const formId = "nomina-form";

  const columns = [
    { key: "NominaId", label: "ID" },
    { key: "NominaNombre", label: "Nombre" },
    { key: "NominaApellido", label: "Apellido" },
    {
      key: "ColegioNombre",
      label: "Colegio",
      render: (nomina: Nomina) => nomina.ColegioNombre || nomina.ColegioId,
    },
    {
      key: "ColegioCursoNombre",
      label: "Curso",
      render: (nomina: Nomina) =>
        nomina.ColegioCursoNombre || nomina.ColegioCursoId,
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
            placeholder="Buscar nominas..."
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nueva Nomina"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Nomina>
        columns={columns}
        data={nominas}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron nominas"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentNomina
            ? `Editar nomina: ${currentNomina.NominaNombre} ${currentNomina.NominaApellido}`
            : "Crear nueva nomina"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentNomina ? "Actualizar" : "Crear"}
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
                      htmlFor="NominaNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="NominaNombre"
                      id="NominaNombre"
                      value={formData.NominaNombre}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "NominaNombre",
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
                      htmlFor="NominaApellido"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Apellido
                    </label>
                    <input
                      type="text"
                      name="NominaApellido"
                      id="NominaApellido"
                      value={formData.NominaApellido}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "NominaApellido",
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
                      htmlFor="ColegioId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Colegio
                    </label>
                    <select
                      name="ColegioId"
                      id="ColegioId"
                      value={formData.ColegioId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {colegios.map((c) => (
                        <option key={c.ColegioId} value={c.ColegioId}>
                          {c.ColegioNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCursoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Curso
                    </label>
                    <select
                      name="ColegioCursoId"
                      id="ColegioCursoId"
                      value={formData.ColegioCursoId}
                      onChange={handleInputChange}
                      required
                      disabled={!formData.ColegioId}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5 disabled:bg-gray-100"
                    >
                      <option value="">Seleccione...</option>
                      {cursos.map((c) => (
                        <option key={c.ColegioCursoId} value={c.ColegioCursoId}>
                          {c.ColegioCursoNombre}
                        </option>
                      ))}
                    </select>
                  </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
