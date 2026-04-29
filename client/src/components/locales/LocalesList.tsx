import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

interface Local {
  id: string | number;
  LocalId: string | number;
  LocalNombre: string;
  LocalTelefono?: string;
  LocalCelular?: string;
  LocalDireccion?: string;
  [key: string]: unknown;
}


interface LocalesListProps {
  locales: Local[];
  onDelete?: (item: Local) => void;
  onEdit?: (item: Local) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentLocal?: Local | null;
  onSubmit: (formData: Local) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function LocalesList({
  locales,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentLocal,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: LocalesListProps) {
  const [formData, setFormData] = useState<Local>({
    id: "",
    LocalId: "",
    LocalNombre: "",
    LocalTelefono: "",
    LocalCelular: "",
    LocalDireccion: "",
  });

  useEffect(() => {
    if (currentLocal) {
      setFormData({
        id: String(currentLocal.id ?? currentLocal.LocalId),
        LocalId: String(currentLocal.LocalId),
        LocalNombre: currentLocal.LocalNombre,
        LocalTelefono: currentLocal.LocalTelefono || "",
        LocalCelular: currentLocal.LocalCelular || "",
        LocalDireccion: currentLocal.LocalDireccion || "",
      });
    } else {
      setFormData({
        id: "",
        LocalId: "",
        LocalNombre: "",
        LocalTelefono: "",
        LocalCelular: "",
        LocalDireccion: "",
      });
    }
  }, [currentLocal]);

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
    onSubmit(formData);
  };

  const formId = "local-form";

  const columns = [
    { key: "LocalId", label: "ID" },
    { key: "LocalNombre", label: "Nombre" },
    { key: "LocalTelefono", label: "Teléfono" },
    { key: "LocalCelular", label: "Celular" },
    { key: "LocalDireccion", label: "Dirección" },
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
            placeholder="Buscar locales"
          />
        </div>
        <div className="py-4">
          <ActionButton
            label="Nuevo Local"
            onClick={onCreate}
            icon={Plus}
          />
        </div>
      </div>
      <DataTable<Local>
        columns={columns}
        data={locales}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron locales"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentLocal
            ? `Editar local: ${currentLocal.LocalId}`
            : "Crear nuevo local"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentLocal ? "Actualizar" : "Crear"}
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
                      htmlFor="LocalNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="LocalNombre"
                      id="LocalNombre"
                      value={formData.LocalNombre}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        handleInputChange({
                          target: {
                            name: "LocalNombre",
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
                      htmlFor="LocalTelefono"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Teléfono
                    </label>
                    <input
                      type="text"
                      name="LocalTelefono"
                      id="LocalTelefono"
                      value={formData.LocalTelefono}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="LocalCelular"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Celular
                    </label>
                    <input
                      type="text"
                      name="LocalCelular"
                      id="LocalCelular"
                      value={formData.LocalCelular}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-6">
                    <label
                      htmlFor="LocalDireccion"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="LocalDireccion"
                      id="LocalDireccion"
                      value={formData.LocalDireccion}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
