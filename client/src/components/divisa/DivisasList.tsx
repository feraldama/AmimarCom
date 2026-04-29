import { Plus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import { formatMiles } from "../../utils/utils";
import { getTiposGasto } from "../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../services/tipogastogrupo.service";
import {
  getDivisaGastosByDivisaId,
  createDivisaGasto,
  updateDivisaGasto,
  deleteDivisaGasto,
} from "../../services/divisagasto.service";
import Swal from "sweetalert2";

interface Divisa {
  id: string | number;
  DivisaId: string | number;
  DivisaNombre: string;
  DivisaCompraMonto: number;
  DivisaVentaMonto: number;
  [key: string]: unknown;
}

interface DivisaGasto {
  DivisaGastoId: number;
  DivisaId: number;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TipoGastoDescripcion?: string;
  TipoGastoGrupoDescripcion?: string;
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


interface DivisasListProps {
  divisas: Divisa[];
  onDelete?: (item: Divisa) => void;
  onEdit?: (item: Divisa) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentDivisa?: Divisa | null;
  onSubmit: (formData: Divisa) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function DivisasList({
  divisas,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentDivisa,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: DivisasListProps) {
  const [formData, setFormData] = useState({
    id: "",
    DivisaId: "",
    DivisaNombre: "",
    DivisaCompraMonto: 0,
    DivisaVentaMonto: 0,
  });

  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);
  const [divisaGastos, setDivisaGastos] = useState<DivisaGasto[]>([]);
  const [loadingGastos, setLoadingGastos] = useState(false);
  const [gastoFormData, setGastoFormData] = useState({
    TipoGastoId: "",
    TipoGastoGrupoId: "",
  });
  const [editGastoId, setEditGastoId] = useState<number | null>(null);
  const [editGastoTipoGastoId, setEditGastoTipoGastoId] = useState("");
  const [editGastoTipoGastoGrupoId, setEditGastoTipoGastoGrupoId] =
    useState("");

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
    if (currentDivisa) {
      setFormData({
        id: String(currentDivisa.id ?? currentDivisa.DivisaId),
        DivisaId: String(currentDivisa.DivisaId),
        DivisaNombre: currentDivisa.DivisaNombre || "",
        DivisaCompraMonto: Number(currentDivisa.DivisaCompraMonto) || 0,
        DivisaVentaMonto: Number(currentDivisa.DivisaVentaMonto) || 0,
      });
      // Cargar gastos de la divisa
      loadDivisaGastos(currentDivisa.DivisaId);
    } else {
      setFormData({
        id: "",
        DivisaId: "",
        DivisaNombre: "",
        DivisaCompraMonto: 0,
        DivisaVentaMonto: 0,
      });
      setDivisaGastos([]);
    }
    setGastoFormData({ TipoGastoId: "", TipoGastoGrupoId: "" });
    setEditGastoId(null);
    setEditGastoTipoGastoId("");
    setEditGastoTipoGastoGrupoId("");
  }, [currentDivisa]);

  const loadDivisaGastos = async (divisaId: string | number) => {
    setLoadingGastos(true);
    try {
      const gastos = await getDivisaGastosByDivisaId(divisaId);
      setDivisaGastos(gastos);
    } catch (err) {
      console.error("Error al cargar gastos de divisa:", err);
      setDivisaGastos([]);
    } finally {
      setLoadingGastos(false);
    }
  };

  const gruposFiltrados = tiposGastoGrupo
    .filter((g) => g.TipoGastoId === Number(gastoFormData.TipoGastoId))
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  const gruposFiltradosEdit = tiposGastoGrupo
    .filter((g) => g.TipoGastoId === Number(editGastoTipoGastoId))
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGastoInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "TipoGastoId") {
      setGastoFormData({
        TipoGastoId: value,
        TipoGastoGrupoId: "",
      });
    } else {
      setGastoFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAddGasto = async () => {
    if (
      !currentDivisa ||
      !gastoFormData.TipoGastoId ||
      !gastoFormData.TipoGastoGrupoId
    ) {
      Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Debe seleccionar Tipo Gasto y Grupo",
      });
      return;
    }

    try {
      await createDivisaGasto({
        DivisaId: currentDivisa.DivisaId,
        TipoGastoId: Number(gastoFormData.TipoGastoId),
        TipoGastoGrupoId: Number(gastoFormData.TipoGastoGrupoId),
      });
      await loadDivisaGastos(currentDivisa.DivisaId);
      setGastoFormData({ TipoGastoId: "", TipoGastoGrupoId: "" });
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Gasto agregado exitosamente",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error("Error al agregar gasto:", err);
      const error = err as { message?: string };
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "No se pudo agregar el gasto",
      });
    }
  };

  const handleUpdateGasto = async (gastoId: number) => {
    if (!editGastoTipoGastoId || !editGastoTipoGastoGrupoId) {
      Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Debe seleccionar Tipo Gasto y Grupo",
      });
      return;
    }

    try {
      await updateDivisaGasto(gastoId, {
        TipoGastoId: Number(editGastoTipoGastoId),
        TipoGastoGrupoId: Number(editGastoTipoGastoGrupoId),
      });
      if (currentDivisa) {
        await loadDivisaGastos(currentDivisa.DivisaId);
      }
      setEditGastoId(null);
      setEditGastoTipoGastoId("");
      setEditGastoTipoGastoGrupoId("");
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Gasto actualizado exitosamente",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error("Error al actualizar gasto:", err);
      const error = err as { message?: string };
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "No se pudo actualizar el gasto",
      });
    }
  };

  const handleDeleteGasto = async (gastoId: number) => {
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
    if (!confirm.isConfirmed || !currentDivisa) return;

    try {
      await deleteDivisaGasto(gastoId);
      await loadDivisaGastos(currentDivisa.DivisaId);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Gasto eliminado exitosamente",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error("Error al eliminar gasto:", err);
      const error = err as { message?: string };
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error?.message || "No se pudo eliminar el gasto",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      DivisaCompraMonto: Number(formData.DivisaCompraMonto),
      DivisaVentaMonto: Number(formData.DivisaVentaMonto),
    });
  };

  const formId = "divisa-form";

  const columns = [
    { key: "DivisaId", label: "ID" },
    { key: "DivisaNombre", label: "Nombre" },
    {
      key: "DivisaCompraMonto",
      label: "Monto Compra",
      render: (divisa: Divisa) =>
        `Gs. ${formatMiles(Number(divisa.DivisaCompraMonto))}`,
    },
    {
      key: "DivisaVentaMonto",
      label: "Monto Venta",
      render: (divisa: Divisa) =>
        `Gs. ${formatMiles(Number(divisa.DivisaVentaMonto))}`,
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
            placeholder="Buscar divisas"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nueva Divisa"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Divisa>
        columns={columns}
        data={divisas}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron divisas"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentDivisa
            ? `Editar divisa: ${currentDivisa.DivisaId}`
            : "Crear nueva divisa"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentDivisa ? "Actualizar" : "Crear"}
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
                      htmlFor="DivisaNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="DivisaNombre"
                      id="DivisaNombre"
                      value={formData.DivisaNombre}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "DivisaNombre",
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
                      htmlFor="DivisaCompraMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto Compra
                    </label>
                    <input
                      type="text"
                      name="DivisaCompraMonto"
                      id="DivisaCompraMonto"
                      value={
                        formData.DivisaCompraMonto
                          ? formatMiles(formData.DivisaCompraMonto)
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(/,/g, ".");
                        const num = Number(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            DivisaCompraMonto: num,
                          }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaVentaMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto Venta
                    </label>
                    <input
                      type="text"
                      name="DivisaVentaMonto"
                      id="DivisaVentaMonto"
                      value={
                        formData.DivisaVentaMonto
                          ? formatMiles(formData.DivisaVentaMonto)
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(/,/g, ".");
                        const num = Number(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            DivisaVentaMonto: num,
                          }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>
                {currentDivisa && (
                  <div className="mt-8">
                    <h4 className="text-lg font-semibold mb-2">
                      Gastos de la Divisa
                    </h4>
                    {loadingGastos ? (
                      <div className="text-gray-500 text-sm">
                        Cargando gastos...
                      </div>
                    ) : (
                      <>
                        <ul className="divide-y divide-gray-200 mb-2">
                          {divisaGastos.map((gasto) => (
                            <li
                              key={gasto.DivisaGastoId}
                              className="py-2 px-1 flex items-center gap-2 hover:bg-gray-100 rounded"
                            >
                              {editGastoId === gasto.DivisaGastoId ? (
                                <>
                                  <select
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                    value={editGastoTipoGastoId}
                                    onChange={(e) => {
                                      setEditGastoTipoGastoId(e.target.value);
                                      setEditGastoTipoGastoGrupoId("");
                                    }}
                                  >
                                    <option value="">
                                      Seleccione Tipo Gasto...
                                    </option>
                                    {tiposGasto.map((tg) => (
                                      <option
                                        key={tg.TipoGastoId}
                                        value={tg.TipoGastoId}
                                      >
                                        {tg.TipoGastoDescripcion}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="border rounded px-2 py-1 text-sm flex-1"
                                    value={editGastoTipoGastoGrupoId}
                                    onChange={(e) =>
                                      setEditGastoTipoGastoGrupoId(
                                        e.target.value
                                      )
                                    }
                                    disabled={!editGastoTipoGastoId}
                                  >
                                    <option value="">
                                      Seleccione Grupo...
                                    </option>
                                    {gruposFiltradosEdit.map((gg) => (
                                      <option
                                        key={gg.TipoGastoGrupoId}
                                        value={gg.TipoGastoGrupoId}
                                      >
                                        {gg.TipoGastoGrupoDescripcion}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="text-success-600 hover:underline text-xs cursor-pointer"
                                    onClick={() =>
                                      handleUpdateGasto(gasto.DivisaGastoId)
                                    }
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    className="text-gray-500 hover:underline text-xs ml-2 cursor-pointer"
                                    onClick={() => {
                                      setEditGastoId(null);
                                      setEditGastoTipoGastoId("");
                                      setEditGastoTipoGastoGrupoId("");
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-700 flex-1">
                                    {gasto.TipoGastoDescripcion || ""} -{" "}
                                    {gasto.TipoGastoGrupoDescripcion || ""}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-primary hover:underline text-xs cursor-pointer"
                                    title="Editar"
                                    onClick={() => {
                                      setEditGastoId(gasto.DivisaGastoId);
                                      setEditGastoTipoGastoId(
                                        String(gasto.TipoGastoId)
                                      );
                                      setEditGastoTipoGastoGrupoId(
                                        String(gasto.TipoGastoGrupoId)
                                      );
                                    }}
                                  >
                                    <Pencil className="h-5 w-5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    className="text-danger-600 hover:underline text-xs ml-2 cursor-pointer"
                                    title="Eliminar"
                                    onClick={() =>
                                      handleDeleteGasto(gasto.DivisaGastoId)
                                    }
                                  >
                                    <Trash2 className="h-5 w-5 inline" />
                                  </button>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2 mt-2">
                          <select
                            className="border rounded px-2 py-1 text-sm flex-1"
                            value={gastoFormData.TipoGastoId}
                            onChange={(e) => {
                              handleGastoInputChange({
                                target: {
                                  name: "TipoGastoId",
                                  value: e.target.value,
                                },
                              } as React.ChangeEvent<HTMLSelectElement>);
                            }}
                          >
                            <option value="">Seleccione Tipo Gasto...</option>
                            {tiposGasto.map((tg) => (
                              <option
                                key={tg.TipoGastoId}
                                value={tg.TipoGastoId}
                              >
                                {tg.TipoGastoDescripcion}
                              </option>
                            ))}
                          </select>
                          <select
                            className="border rounded px-2 py-1 text-sm flex-1"
                            value={gastoFormData.TipoGastoGrupoId}
                            onChange={(e) => {
                              handleGastoInputChange({
                                target: {
                                  name: "TipoGastoGrupoId",
                                  value: e.target.value,
                                },
                              } as React.ChangeEvent<HTMLSelectElement>);
                            }}
                            disabled={!gastoFormData.TipoGastoId}
                          >
                            <option value="">Seleccione Grupo...</option>
                            {gruposFiltrados.map((gg) => (
                              <option
                                key={gg.TipoGastoGrupoId}
                                value={gg.TipoGastoGrupoId}
                              >
                                {gg.TipoGastoGrupoDescripcion}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-white bg-primary hover:bg-primary-700 rounded px-3 py-1 text-xs"
                            onClick={handleAddGasto}
                          >
                            Agregar
                          </button>
                        </div>
                        {divisaGastos.length === 0 && !loadingGastos && (
                          <div className="text-gray-500 text-sm mt-2">
                            No hay gastos asociados.
                          </div>
                        )}
                      </>
                    )}
          </div>
        )}
        </form>
      </Modal>
    </>
  );
}
