import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import { formatMiles } from "../../utils/utils";
import { getTiposGasto } from "../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../services/tipogastogrupo.service";

interface Transporte {
  id: string | number;
  TransporteId: string | number;
  TransporteNombre: string;
  TransporteTelefono: string;
  TransporteDireccion: string;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TransporteComision: number;
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


interface TransportesListProps {
  transportes: Transporte[];
  onDelete?: (item: Transporte) => void;
  onEdit?: (item: Transporte) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentTransporte?: Transporte | null;
  onSubmit: (formData: Transporte) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function TransportesList({
  transportes,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentTransporte,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: TransportesListProps) {
  const [formData, setFormData] = useState({
    id: "",
    TransporteId: "",
    TransporteNombre: "",
    TransporteTelefono: "",
    TransporteDireccion: "",
    TipoGastoId: "",
    TipoGastoGrupoId: "",
    TransporteComision: 0,
  });

  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);

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
    if (currentTransporte) {
      setFormData({
        id: String(currentTransporte.id ?? currentTransporte.TransporteId),
        TransporteId: String(currentTransporte.TransporteId),
        TransporteNombre: currentTransporte.TransporteNombre || "",
        TransporteTelefono: currentTransporte.TransporteTelefono || "",
        TransporteDireccion: currentTransporte.TransporteDireccion || "",
        TipoGastoId: currentTransporte.TipoGastoId
          ? String(currentTransporte.TipoGastoId)
          : "",
        TipoGastoGrupoId: currentTransporte.TipoGastoGrupoId
          ? String(currentTransporte.TipoGastoGrupoId)
          : "",
        TransporteComision: Number(currentTransporte.TransporteComision) || 0,
      });
    } else {
      setFormData({
        id: "",
        TransporteId: "",
        TransporteNombre: "",
        TransporteTelefono: "",
        TransporteDireccion: "",
        TipoGastoId: "",
        TipoGastoGrupoId: "",
        TransporteComision: 0,
      });
    }
  }, [currentTransporte]);

  const gruposFiltrados = tiposGastoGrupo
    .filter((g) => g.TipoGastoId === Number(formData.TipoGastoId))
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
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
        [name]: name === "TransporteComision" ? Number(value) : value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Convertir TipoGastoId y TipoGastoGrupoId a números antes de enviar
    onSubmit({
      ...formData,
      TipoGastoId: Number(formData.TipoGastoId),
      TipoGastoGrupoId: Number(formData.TipoGastoGrupoId),
    });
  };

  const formId = "transporte-form";

  const columns = [
    { key: "TransporteId", label: "ID" },
    { key: "TransporteNombre", label: "Nombre" },
    { key: "TransporteTelefono", label: "Teléfono" },
    { key: "TransporteDireccion", label: "Dirección" },
    {
      key: "TipoGastoDescripcion",
      label: "Tipo Gasto",
      render: (transporte: Transporte) => transporte.TipoGastoDescripcion || "",
    },
    {
      key: "TipoGastoGrupoDescripcion",
      label: "Grupo",
      render: (transporte: Transporte) =>
        transporte.TipoGastoGrupoDescripcion || "",
    },
    {
      key: "TransporteComision",
      label: "Comisión",
      render: (transporte: Transporte) =>
        `Gs. ${formatMiles(Number(transporte.TransporteComision))}`,
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
            placeholder="Buscar transportes"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Transporte"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Transporte>
        columns={columns}
        data={transportes}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron transportes"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentTransporte
            ? `Editar transporte: ${currentTransporte.TransporteId}`
            : "Crear nuevo transporte"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentTransporte ? "Actualizar" : "Crear"}
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
                      htmlFor="TransporteNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="TransporteNombre"
                      id="TransporteNombre"
                      value={formData.TransporteNombre}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "TransporteNombre",
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
                      htmlFor="TransporteTelefono"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Teléfono
                    </label>
                    <input
                      type="text"
                      name="TransporteTelefono"
                      id="TransporteTelefono"
                      value={formData.TransporteTelefono}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TransporteDireccion"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="TransporteDireccion"
                      id="TransporteDireccion"
                      value={formData.TransporteDireccion}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TipoGastoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo Gasto
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
                      Grupo
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
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TransporteComision"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Comisión
                    </label>
                    <input
                      type="text"
                      name="TransporteComision"
                      id="TransporteComision"
                      value={
                        formData.TransporteComision
                          ? formatMiles(formData.TransporteComision)
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
                            TransporteComision: num,
                          }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      inputMode="numeric"
                    />
                  </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
