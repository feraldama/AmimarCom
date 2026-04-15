import { Plus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import { getTiposGasto } from "../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../services/tipogastogrupo.service";
import {
  getColegioById,
  getColegioCursos,
  createColegioCurso,
  updateColegioCurso,
  deleteColegioCurso,
} from "../../services/colegio.service";
import { formatMiles } from "../../utils/utils";
import Swal from "sweetalert2";

interface Colegio {
  id: string | number;
  ColegioId: string | number;
  ColegioNombre: string;
  ColegioCantCurso: number;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  TipoGastoDescripcion?: string;
  TipoGastoGrupoDescripcion?: string;
  [key: string]: unknown;
}

interface TipoGasto {
  TipoGastoId: number;
  TipoGastoDescripcion: string;
}

interface TipoGastoGrupo {
  TipoGastoGrupoId: number;
  TipoGastoGrupoDescripcion: string;
  TipoGastoId: number;
}

interface ColegioCurso {
  ColegioId: string | number;
  ColegioCursoId: string | number;
  ColegioCursoNombre: string;
  ColegioCursoImporte: number;
}

interface Pagination {
  totalItems: number;
}

interface ColegiosListProps {
  colegios: Colegio[];
  onDelete?: (item: Colegio) => void;
  onEdit?: (item: Colegio) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentColegio?: Colegio | null;
  onSubmit: (formData: Colegio) => void;
  onCurrentColegioChange?: (colegio: Colegio | null) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function ColegiosList({
  colegios,
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
  currentColegio,
  onSubmit,
  onCurrentColegioChange,
  sortKey,
  sortOrder,
  onSort,
}: ColegiosListProps) {
  const [formData, setFormData] = useState({
    id: "",
    ColegioId: "",
    ColegioNombre: "",
    ColegioCantCurso: 0,
    TipoGastoId: "",
    TipoGastoGrupoId: "",
  });

  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);
  const [cursos, setCursos] = useState<ColegioCurso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [nuevoCurso, setNuevoCurso] = useState({
    ColegioCursoNombre: "",
    ColegioCursoImporte: 0,
  });
  const [editCursoId, setEditCursoId] = useState<string | number | null>(null);
  const [editCursoNombre, setEditCursoNombre] = useState("");
  const [editCursoImporte, setEditCursoImporte] = useState(0);

  useEffect(() => {
    const fetchTiposGasto = async () => {
      try {
        const tiposGastoData = await getTiposGasto();
        setTiposGasto(tiposGastoData);
        const tiposGastoGrupoData = await getTiposGastoGrupo();
        setTiposGastoGrupo(tiposGastoGrupoData);
      } catch (error) {
        console.error("Error al cargar tipos de gasto:", error);
      }
    };
    fetchTiposGasto();
  }, []);

  useEffect(() => {
    if (currentColegio) {
      setFormData({
        id: String(currentColegio.id ?? currentColegio.ColegioId),
        ColegioId: String(currentColegio.ColegioId),
        ColegioNombre: currentColegio.ColegioNombre || "",
        ColegioCantCurso: currentColegio.ColegioCantCurso || 0,
        TipoGastoId: currentColegio.TipoGastoId
          ? String(currentColegio.TipoGastoId)
          : "",
        TipoGastoGrupoId: currentColegio.TipoGastoGrupoId
          ? String(currentColegio.TipoGastoGrupoId)
          : "",
      });
    } else {
      setFormData({
        id: "",
        ColegioId: "",
        ColegioNombre: "",
        ColegioCantCurso: 0,
        TipoGastoId: "",
        TipoGastoGrupoId: "",
      });
    }
  }, [currentColegio]);

  useEffect(() => {
    if (currentColegio && currentColegio.ColegioId) {
      setLoadingCursos(true);
      getColegioCursos(currentColegio.ColegioId)
        .then((data) => setCursos(data))
        .catch(() => setCursos([]))
        .finally(() => setLoadingCursos(false));
    } else {
      setCursos([]);
    }
  }, [currentColegio]);

  const gruposFiltrados = tiposGastoGrupo.filter(
    (g) => g.TipoGastoId === Number(formData.TipoGastoId)
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "TipoGastoId") {
      // Reset grupo cuando cambia tipo de gasto
      setFormData((prev) => ({
        ...prev,
        TipoGastoId: value,
        TipoGastoGrupoId: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === "ColegioCantCurso" ? Number(value) : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Excluir ColegioCantCurso del envío ya que se actualiza automáticamente
    const dataToSubmit: Partial<Colegio> = {
      id: formData.id,
      ColegioId: formData.ColegioId,
      ColegioNombre: formData.ColegioNombre,
      TipoGastoId: formData.TipoGastoId,
      TipoGastoGrupoId: formData.TipoGastoGrupoId,
    };
    onSubmit(dataToSubmit as Colegio);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseModal();
    }
  };

  const columns = [
    { key: "ColegioId", label: "ID" },
    { key: "ColegioNombre", label: "Nombre" },
    { key: "ColegioCantCurso", label: "Cant. Cursos" },
    {
      key: "TipoGastoDescripcion",
      label: "Tipo Gasto",
      render: (colegio: Colegio) =>
        colegio.TipoGastoDescripcion || colegio.TipoGastoId,
    },
    {
      key: "TipoGastoGrupoDescripcion",
      label: "Grupo Gasto",
      render: (colegio: Colegio) =>
        colegio.TipoGastoGrupoDescripcion || colegio.TipoGastoGrupoId,
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
            placeholder="Buscar colegios..."
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Colegio"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Colegio>
        columns={columns}
        data={colegios}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron colegios"
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
          <div className="relative w-full max-w-2xl max-h-[90vh] z-10 flex flex-col">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow flex flex-col max-h-[90vh]"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t flex-shrink-0">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentColegio
                    ? `Editar colegio: ${currentColegio.ColegioNombre}`
                    : "Crear nuevo colegio"}
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
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="ColegioNombre"
                      id="ColegioNombre"
                      value={formData.ColegioNombre}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "ColegioNombre",
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
                      htmlFor="ColegioCantCurso"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cantidad de Cursos
                    </label>
                    <input
                      type="number"
                      name="ColegioCantCurso"
                      id="ColegioCantCurso"
                      value={formData.ColegioCantCurso}
                      onChange={handleInputChange}
                      className="bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-lg block w-full p-2.5"
                      disabled
                      readOnly
                      title="Este campo se actualiza automáticamente al agregar o eliminar cursos"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TipoGastoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo de Gasto
                    </label>
                    <select
                      name="TipoGastoId"
                      id="TipoGastoId"
                      value={formData.TipoGastoId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {tiposGasto.map((tg) => (
                        <option key={tg.TipoGastoId} value={tg.TipoGastoId}>
                          {tg.TipoGastoDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TipoGastoGrupoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Grupo de Gasto
                    </label>
                    <select
                      name="TipoGastoGrupoId"
                      id="TipoGastoGrupoId"
                      value={formData.TipoGastoGrupoId}
                      onChange={handleInputChange}
                      required
                      disabled={!formData.TipoGastoId}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5 disabled:bg-gray-100"
                    >
                      <option value="">Seleccione...</option>
                      {gruposFiltrados.map((gg) => (
                        <option
                          key={gg.TipoGastoGrupoId}
                          value={gg.TipoGastoGrupoId}
                        >
                          {gg.TipoGastoGrupoDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Detalle: cursos del colegio */}
                {currentColegio && (
                  <div className="mt-8">
                    <h4 className="text-lg font-semibold mb-2">
                      Cursos del colegio
                    </h4>
                    {loadingCursos ? (
                      <div className="text-gray-500 text-sm">
                        Cargando cursos...
                      </div>
                    ) : (
                      <>
                        <ul className="divide-y divide-gray-200 mb-2">
                          {cursos.map((c) => (
                            <li
                              key={c.ColegioCursoId}
                              className="py-2 px-1 flex items-center gap-2 hover:bg-gray-100 rounded"
                            >
                              {editCursoId === c.ColegioCursoId ? (
                                <>
                                  <input
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                    value={editCursoNombre}
                                    onChange={(e) =>
                                      setEditCursoNombre(
                                        e.target.value.toUpperCase()
                                      )
                                    }
                                    placeholder="Nombre del curso"
                                  />
                                  <input
                                    type="text"
                                    className="border rounded px-2 py-1 text-sm w-32"
                                    value={
                                      editCursoImporte
                                        ? formatMiles(editCursoImporte)
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const raw = e.target.value
                                        .replace(/\./g, "")
                                        .replace(/\s/g, "");
                                      const num = Number(raw);
                                      if (!isNaN(num)) {
                                        setEditCursoImporte(num);
                                      }
                                    }}
                                    placeholder="Importe"
                                  />
                                  <button
                                    type="button"
                                    className="text-success-600 hover:underline text-xs cursor-pointer"
                                    onClick={async () => {
                                      try {
                                        await updateColegioCurso(
                                          currentColegio.ColegioId,
                                          c.ColegioCursoId,
                                          {
                                            ColegioCursoNombre: editCursoNombre,
                                            ColegioCursoImporte:
                                              editCursoImporte,
                                          }
                                        );
                                        setEditCursoId(null);
                                        setEditCursoNombre("");
                                        setEditCursoImporte(0);
                                        setLoadingCursos(true);
                                        const data = await getColegioCursos(
                                          currentColegio.ColegioId
                                        );
                                        setCursos(data);
                                        setLoadingCursos(false);
                                        // Actualizar el colegio para reflejar cambios en ColegioCantCurso
                                        if (onCurrentColegioChange) {
                                          const updatedColegio =
                                            await getColegioById(
                                              currentColegio.ColegioId
                                            );
                                          onCurrentColegioChange({
                                            ...updatedColegio,
                                            id: updatedColegio.ColegioId,
                                          });
                                        }
                                        Swal.fire({
                                          position: "top-end",
                                          icon: "success",
                                          title:
                                            "Curso actualizado exitosamente",
                                          showConfirmButton: false,
                                          timer: 1500,
                                        });
                                      } catch (error: unknown) {
                                        const err = error as {
                                          message?: string;
                                        };
                                        if (err?.message) {
                                          Swal.fire({
                                            icon: "warning",
                                            title: "No permitido",
                                            text: err.message,
                                          });
                                        } else {
                                          throw error;
                                        }
                                      }
                                    }}
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    className="text-gray-500 hover:underline text-xs ml-2 cursor-pointer"
                                    onClick={() => {
                                      setEditCursoId(null);
                                      setEditCursoNombre("");
                                      setEditCursoImporte(0);
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-700 flex-1">
                                    {c.ColegioCursoId}- {c.ColegioCursoNombre} -
                                    Gs. {formatMiles(c.ColegioCursoImporte)}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-primary hover:underline text-xs cursor-pointer"
                                    title="Editar"
                                    onClick={() => {
                                      setEditCursoId(c.ColegioCursoId);
                                      setEditCursoNombre(c.ColegioCursoNombre);
                                      setEditCursoImporte(
                                        c.ColegioCursoImporte
                                      );
                                    }}
                                  >
                                    <Pencil className="h-5 w-5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    className="text-danger-600 hover:underline text-xs ml-2 cursor-pointer"
                                    title="Eliminar"
                                    onClick={async () => {
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
                                        await deleteColegioCurso(
                                          currentColegio.ColegioId,
                                          c.ColegioCursoId
                                        );
                                        setLoadingCursos(true);
                                        const data = await getColegioCursos(
                                          currentColegio.ColegioId
                                        );
                                        setCursos(data);
                                        setLoadingCursos(false);
                                        // Actualizar el colegio para reflejar cambios en ColegioCantCurso
                                        if (onCurrentColegioChange) {
                                          const updatedColegio =
                                            await getColegioById(
                                              currentColegio.ColegioId
                                            );
                                          onCurrentColegioChange({
                                            ...updatedColegio,
                                            id: updatedColegio.ColegioId,
                                          });
                                        }
                                        Swal.fire({
                                          position: "top-end",
                                          icon: "success",
                                          title: "Curso eliminado exitosamente",
                                          showConfirmButton: false,
                                          timer: 1500,
                                        });
                                      } catch (error: unknown) {
                                        const err = error as {
                                          message?: string;
                                        };
                                        if (err?.message) {
                                          Swal.fire({
                                            icon: "warning",
                                            title: "No permitido",
                                            text: err.message,
                                          });
                                        } else {
                                          throw error;
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-5 w-5 inline" />
                                  </button>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2 mt-2">
                          <input
                            className="border rounded px-2 py-1 text-sm flex-1"
                            placeholder="Nombre del curso..."
                            value={nuevoCurso.ColegioCursoNombre}
                            onChange={(e) =>
                              setNuevoCurso((prev) => ({
                                ...prev,
                                ColegioCursoNombre:
                                  e.target.value.toUpperCase(),
                              }))
                            }
                          />
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-sm w-32"
                            placeholder="Importe..."
                            value={
                              nuevoCurso.ColegioCursoImporte
                                ? formatMiles(nuevoCurso.ColegioCursoImporte)
                                : ""
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                                .replace(/\./g, "")
                                .replace(/\s/g, "");
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setNuevoCurso((prev) => ({
                                  ...prev,
                                  ColegioCursoImporte: num,
                                }));
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="text-white bg-primary hover:bg-primary-700 rounded px-3 py-1 text-xs"
                            onClick={async () => {
                              if (
                                !nuevoCurso.ColegioCursoNombre.trim() ||
                                nuevoCurso.ColegioCursoImporte <= 0
                              ) {
                                Swal.fire({
                                  icon: "warning",
                                  title: "Complete todos los campos",
                                });
                                return;
                              }
                              try {
                                await createColegioCurso({
                                  ColegioId: currentColegio.ColegioId,
                                  ColegioCursoNombre:
                                    nuevoCurso.ColegioCursoNombre,
                                  ColegioCursoImporte:
                                    nuevoCurso.ColegioCursoImporte,
                                });
                                setNuevoCurso({
                                  ColegioCursoNombre: "",
                                  ColegioCursoImporte: 0,
                                });
                                setLoadingCursos(true);
                                const data = await getColegioCursos(
                                  currentColegio.ColegioId
                                );
                                setCursos(data);
                                setLoadingCursos(false);
                                // Actualizar el colegio para reflejar cambios en ColegioCantCurso
                                if (onCurrentColegioChange) {
                                  const updatedColegio = await getColegioById(
                                    currentColegio.ColegioId
                                  );
                                  onCurrentColegioChange({
                                    ...updatedColegio,
                                    id: updatedColegio.ColegioId,
                                  });
                                }
                                Swal.fire({
                                  position: "top-end",
                                  icon: "success",
                                  title: "Curso agregado exitosamente",
                                  showConfirmButton: false,
                                  timer: 1500,
                                });
                              } catch (error: unknown) {
                                const err = error as { message?: string };
                                if (err?.message) {
                                  Swal.fire({
                                    icon: "warning",
                                    title: "No permitido",
                                    text: err.message,
                                  });
                                } else {
                                  throw error;
                                }
                              }
                            }}
                          >
                            Agregar
                          </button>
                        </div>
                        {cursos.length === 0 && !loadingCursos && (
                          <div className="text-gray-500 text-sm mt-2">
                            No hay cursos asociados.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b flex-shrink-0">
                <ActionButton
                  label={currentColegio ? "Actualizar" : "Crear"}
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
