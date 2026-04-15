import { useEffect, useState, useCallback } from "react";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Swal from "sweetalert2";
import {
  getColegioCursos,
  createColegioCurso,
  updateColegioCurso,
  deleteColegioCurso,
} from "../../services/colegio.service";
import { formatMiles } from "../../utils/utils";

interface ColegioCurso {
  ColegioId: string | number;
  ColegioCursoId: string | number;
  ColegioCursoNombre: string;
  ColegioCursoImporte: number;
  [key: string]: unknown;
}

interface ColegioCursosListProps {
  colegioId: string | number;
  onCursosChange?: () => void;
}

export default function ColegioCursosList({
  colegioId,
  onCursosChange,
}: ColegioCursosListProps) {
  const [cursos, setCursos] = useState<ColegioCurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ColegioCurso>>({});
  const [nuevoCurso, setNuevoCurso] = useState({
    ColegioCursoNombre: "",
    ColegioCursoImporte: 0,
  });

  const fetchCursos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getColegioCursos(colegioId);
      setCursos(data);
    } catch {
      setError("Error al obtener cursos del colegio");
    } finally {
      setLoading(false);
    }
  }, [colegioId]);

  useEffect(() => {
    fetchCursos();
  }, [colegioId, fetchCursos]);

  const handleDelete = async (
    curso: ColegioCurso & { id: string | number }
  ) => {
    const confirm = await Swal.fire({
      title: "¿Estás seguro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar!",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      // Usar colegioId del prop y ColegioCursoId del curso
      // El ColegioCursoId debe estar presente en el objeto curso
      const cursoIdToDelete = curso.ColegioCursoId || curso.id;
      if (!cursoIdToDelete) {
        throw new Error("No se pudo obtener el ID del curso a eliminar");
      }
      await deleteColegioCurso(colegioId, cursoIdToDelete);
      await fetchCursos();
      // Notificar al componente padre para que actualice el colegio
      // El backend ya actualiza ColegioCantCurso automáticamente
      if (onCursosChange) {
        onCursosChange();
      }
      Swal.fire({
        icon: "success",
        title: "Curso eliminado exitosamente",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error al eliminar curso:", error);
      let errorMessage = "Error al eliminar curso";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        const err = error as {
          message?: string;
          response?: { data?: { message?: string } };
        };
        errorMessage =
          err?.response?.data?.message || err?.message || errorMessage;
      }
      Swal.fire({
        icon: "error",
        title: "Error al eliminar curso",
        text: errorMessage,
      });
    }
  };

  const handleEdit = (curso: ColegioCurso) => {
    setFormData(curso);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.ColegioCursoId) {
        await updateColegioCurso(colegioId, formData.ColegioCursoId, formData);
        Swal.fire({
          icon: "success",
          title: "Curso actualizado",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await createColegioCurso({
          ColegioId: colegioId,
          ColegioCursoNombre: formData.ColegioCursoNombre,
          ColegioCursoImporte: formData.ColegioCursoImporte,
        });
        Swal.fire({
          icon: "success",
          title: "Curso creado",
          timer: 1500,
          showConfirmButton: false,
        });
      }
      setIsModalOpen(false);
      setFormData({});
      await fetchCursos();
      // Notificar al componente padre para que actualice el colegio
      if (onCursosChange) {
        onCursosChange();
      }
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error al guardar curso",
      });
    }
  };

  const handleAddCurso = async () => {
    if (!nuevoCurso.ColegioCursoNombre || nuevoCurso.ColegioCursoImporte <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Complete todos los campos",
      });
      return;
    }
    try {
      await createColegioCurso({
        ColegioId: colegioId,
        ColegioCursoNombre: nuevoCurso.ColegioCursoNombre,
        ColegioCursoImporte: nuevoCurso.ColegioCursoImporte,
      });
      setNuevoCurso({ ColegioCursoNombre: "", ColegioCursoImporte: 0 });
      await fetchCursos();
      // Notificar al componente padre para que actualice el colegio
      if (onCursosChange) {
        onCursosChange();
      }
      Swal.fire({
        icon: "success",
        title: "Curso agregado exitosamente",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error al agregar curso",
      });
    }
  };

  const columns = [
    { key: "ColegioCursoId", label: "ID" },
    { key: "ColegioCursoNombre", label: "Nombre" },
    {
      key: "ColegioCursoImporte",
      label: "Importe",
      render: (curso: ColegioCurso & { id: string | number }) =>
        `Gs. ${formatMiles(curso.ColegioCursoImporte)}`,
    },
  ];

  const cursosWithId: (ColegioCurso & { id: string | number })[] = cursos.map(
    (c) => ({
      ...c,
      id: c.ColegioCursoId,
      ColegioId: c.ColegioId || colegioId, // Asegurar que ColegioId esté presente
      ColegioCursoId: c.ColegioCursoId, // Asegurar que ColegioCursoId esté presente
    })
  );

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <DataTable<ColegioCurso & { id: string | number }>
        columns={columns}
        data={cursosWithId}
        onEdit={handleEdit}
        onDelete={(c) => handleDelete(c)}
        emptyMessage="No hay cursos registrados"
      />
      {/* Inputs para agregar nuevo curso */}
      <div className="flex flex-col sm:flex-row gap-2 mt-2">
        <input
          type="text"
          placeholder="Nombre del curso..."
          className="border rounded px-2 py-1 text-sm flex-1"
          value={nuevoCurso.ColegioCursoNombre}
          onChange={(e) =>
            setNuevoCurso((prev) => ({
              ...prev,
              ColegioCursoNombre: e.target.value.toUpperCase(),
            }))
          }
        />
        <input
          type="text"
          placeholder="Importe..."
          className="border rounded px-2 py-1 text-sm flex-1"
          value={
            nuevoCurso.ColegioCursoImporte
              ? formatMiles(nuevoCurso.ColegioCursoImporte)
              : ""
          }
          onChange={(e) => {
            const raw = e.target.value.replace(/\./g, "").replace(/\s/g, "");
            const num = Number(raw);
            if (!isNaN(num)) {
              setNuevoCurso((prev) => ({ ...prev, ColegioCursoImporte: num }));
            }
          }}
        />
        <button
          type="button"
          className="text-white bg-primary hover:bg-primary-700 rounded px-3 py-1 text-xs"
          onClick={handleAddCurso}
        >
          Agregar
        </button>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black opacity-50"
            onClick={() => {
              setIsModalOpen(false);
              setFormData({});
            }}
          />
          <form
            onSubmit={handleSubmit}
            className="relative bg-white rounded-lg shadow p-6 z-10 max-w-md w-full"
          >
            <h3 className="text-lg font-semibold mb-4">
              {formData.ColegioCursoId ? "Editar Curso" : "Nuevo Curso"}
            </h3>
            <div className="mb-4">
              <label className="block mb-1">Nombre del Curso</label>
              <input
                type="text"
                value={formData.ColegioCursoNombre || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ColegioCursoNombre: e.target.value.toUpperCase(),
                  }))
                }
                className="w-full border rounded px-2 py-1"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Importe</label>
              <input
                type="text"
                value={
                  formData.ColegioCursoImporte
                    ? formatMiles(formData.ColegioCursoImporte)
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/\s/g, "");
                  const num = Number(raw);
                  if (!isNaN(num)) {
                    setFormData((prev) => ({
                      ...prev,
                      ColegioCursoImporte: num,
                    }));
                  }
                }}
                className="w-full border rounded px-2 py-1"
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <ActionButton label="Guardar" type="submit" />
              <ActionButton
                label="Cancelar"
                variant="secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setFormData({});
                }}
              />
            </div>
          </form>
        </div>
      )}
      {loading && <div>Cargando cursos...</div>}
      {error && <div className="text-destructive">{error}</div>}
    </div>
  );
}
