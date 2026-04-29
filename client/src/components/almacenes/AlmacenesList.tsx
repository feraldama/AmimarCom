import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

interface Almacen {
  id: string | number;
  AlmacenId: string | number;
  AlmacenNombre: string;
  [key: string]: unknown;
}


interface AlmacenesListProps {
  almacenes: Almacen[];
  onDelete?: (item: Almacen) => void;
  onEdit?: (item: Almacen) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentAlmacen?: Almacen | null;
  onSubmit: (formData: Almacen) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function AlmacenesList({
  almacenes,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentAlmacen,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: AlmacenesListProps) {
  const [formData, setFormData] = useState({
    id: "",
    AlmacenId: "",
    AlmacenNombre: "",
  });

  useEffect(() => {
    if (currentAlmacen) {
      setFormData({
        id: String(currentAlmacen.id ?? currentAlmacen.AlmacenId),
        AlmacenId: String(currentAlmacen.AlmacenId),
        AlmacenNombre: currentAlmacen.AlmacenNombre,
      });
    } else {
      setFormData({
        id: "",
        AlmacenId: "",
        AlmacenNombre: "",
      });
    }
  }, [currentAlmacen]);

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
    onSubmit(formData as Almacen);
  };

  const formId = "almacen-form";

  const columns = [
    { key: "AlmacenId", label: "ID" },
    { key: "AlmacenNombre", label: "Nombre" },
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
            placeholder="Buscar almacenes"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Almacén"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Almacen>
        columns={columns}
        data={almacenes}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron almacenes"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentAlmacen
            ? `Editar almacén: ${currentAlmacen.AlmacenId}`
            : "Crear nuevo almacén"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentAlmacen ? "Actualizar" : "Crear"}
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
            <div className="col-span-6 sm:col-span-6">
              <label
                htmlFor="AlmacenNombre"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Nombre
              </label>
              <input
                type="text"
                name="AlmacenNombre"
                id="AlmacenNombre"
                value={formData.AlmacenNombre}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  handleInputChange({
                    target: {
                      name: "AlmacenNombre",
                      value: value,
                    },
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
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
