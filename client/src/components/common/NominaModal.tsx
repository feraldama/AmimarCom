import { Plus } from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import ActionButton from "./Button/ActionButton";
import { getColegios } from "../../services/colegio.service";
import { getColegioCursos } from "../../services/colegio.service";
import Modal from "./Modal";

// Definir la interfaz Nomina localmente
interface Nomina {
  NominaId: number;
  NominaNombre: string;
  NominaApellido: string;
  ColegioId: number;
  ColegioCursoId: number;
  ColegioNombre?: string;
  ColegioCursoNombre?: string;
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

interface NominaModalProps {
  show: boolean;
  onClose: () => void;
  nominas: Nomina[];
  onSelect: (nomina: Nomina) => void;
  onCreateNomina?: (nomina: Nomina) => void;
}

const NominaModal: React.FC<NominaModalProps> = ({
  show,
  onClose,
  nominas,
  onSelect,
  onCreateNomina,
}) => {
  const [filtros, setFiltros] = useState({
    nombre: "",
    apellido: "",
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [cursos, setCursos] = useState<ColegioCurso[]>([]);
  const [formData, setFormData] = useState<Nomina>({
    NominaId: 0,
    NominaNombre: "",
    NominaApellido: "",
    ColegioId: 0,
    ColegioCursoId: 0,
  });

  // Cargar colegios al montar el componente
  useEffect(() => {
    const fetchColegios = async () => {
      try {
        const data = await getColegios(1, 1000);
        setColegios(data.data || []);
      } catch (error) {
        console.error("Error al cargar colegios:", error);
      }
    };
    fetchColegios();
  }, []);

  // Cargar cursos cuando se selecciona un colegio
  useEffect(() => {
    const fetchCursos = async () => {
      if (formData.ColegioId > 0) {
        try {
          const cursosData = await getColegioCursos(formData.ColegioId);
          setCursos(cursosData || []);
          // Resetear curso cuando cambia el colegio
          setFormData((prev) => ({ ...prev, ColegioCursoId: 0 }));
        } catch (error) {
          console.error("Error al cargar cursos:", error);
          setCursos([]);
        }
      } else {
        setCursos([]);
        setFormData((prev) => ({ ...prev, ColegioCursoId: 0 }));
      }
    };
    fetchCursos();
  }, [formData.ColegioId]);

  const nominasFiltradas = useMemo(() => {
    return nominas.filter(
      (n) =>
        n.NominaNombre.toLowerCase().includes(filtros.nombre.toLowerCase()) &&
        (n.NominaApellido || "")
          .toLowerCase()
          .includes(filtros.apellido.toLowerCase())
    );
  }, [nominas, filtros]);

  const totalPages = Math.ceil(nominasFiltradas.length / rowsPerPage);
  const paginatedNominas = nominasFiltradas.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "NominaNombre" || name === "NominaApellido"
          ? value.toUpperCase()
          : name === "ColegioId" || name === "ColegioCursoId"
          ? Number(value) || 0
          : value,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Validar campos requeridos
    if (
      !formData.NominaNombre ||
      !formData.ColegioId ||
      formData.ColegioId === 0 ||
      !formData.ColegioCursoId ||
      formData.ColegioCursoId === 0
    ) {
      return;
    }

    if (onCreateNomina) {
      try {
        await onCreateNomina(formData);
        setShowCreateModal(false);
        // Reset form data
        setFormData({
          NominaId: 0,
          NominaNombre: "",
          NominaApellido: "",
          ColegioId: 0,
          ColegioCursoId: 0,
        });
        setCursos([]);
      } catch (error) {
        // El error ya se maneja en el componente padre
        console.error("Error al crear nómina:", error);
        // No cerrar el modal si hay error
      }
    }
  };

  return (
    <Modal isOpen={show} onClose={onClose} title="Buscar Nómina" size="4xl">
      <div className="flex justify-end mb-4">
        {onCreateNomina && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            Nueva Nómina
          </button>
        )}
      </div>
      <div className="bg-gray-50 rounded-lg p-4 mb-4 flex-shrink-0">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Nombre
            </label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.nombre}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, nombre: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Apellido
            </label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.apellido}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, apellido: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto rounded-lg flex-1 min-h-0">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="py-2 px-4 text-left">ID</th>
              <th className="py-2 px-4 text-left">Nombre</th>
              <th className="py-2 px-4 text-left">Apellido</th>
              <th className="py-2 px-4 text-left">Colegio</th>
              <th className="py-2 px-4 text-left">Curso</th>
            </tr>
          </thead>
          <tbody>
            {paginatedNominas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-400">
                  No hay nóminas
                </td>
              </tr>
            )}
            {paginatedNominas.map((n) => (
              <tr
                key={n.NominaId}
                className="hover:bg-primary-50 cursor-pointer transition"
                onClick={() => onSelect(n)}
              >
                <td className="py-2 px-4">{n.NominaId}</td>
                <td className="py-2 px-4">{n.NominaNombre}</td>
                <td className="py-2 px-4">{n.NominaApellido || ""}</td>
                <td className="py-2 px-4">{n.ColegioNombre || ""}</td>
                <td className="py-2 px-4">{n.ColegioCursoNombre || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Paginación */}
      <div className="flex items-center justify-between mt-4 flex-shrink-0">
        <div className="text-sm text-gray-500">
          {nominasFiltradas.length === 0
            ? "0"
            : `${(page - 1) * rowsPerPage + 1} to ${Math.min(
                page * rowsPerPage,
                nominasFiltradas.length
              )} of ${nominasFiltradas.length}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Filas por página:</span>
          <select
            className="border border-gray-200 rounded px-2 py-1 text-sm"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1 rounded text-gray-500 border border-gray-200 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page === 1}
          >
            Anterior
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded text-gray-500 border border-gray-200 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page === totalPages || totalPages === 0}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal para crear nómina */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear nueva nómina"
        size="2xl"
        footer={
          <>
            <ActionButton label="Crear" type="submit" form="nomina-create-form" />
            <ActionButton
              label="Cancelar"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            />
          </>
        }
      >
        <form
          id="nomina-create-form"
          onSubmit={handleCreateSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-6">
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
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
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                  required
                >
                  <option value="0">Seleccione un colegio</option>
                  {colegios.map((colegio) => (
                    <option
                      key={colegio.ColegioId}
                      value={colegio.ColegioId}
                    >
                      {colegio.ColegioNombre}
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
                  disabled={
                    !formData.ColegioId || formData.ColegioId === 0
                  }
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5 disabled:bg-gray-100"
                  required
                >
                  <option value="0">Seleccione un curso</option>
                  {cursos.map((curso) => (
                    <option
                      key={curso.ColegioCursoId}
                      value={curso.ColegioCursoId}
                    >
                      {curso.ColegioCursoNombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </Modal>
  );
};

export default NominaModal;
