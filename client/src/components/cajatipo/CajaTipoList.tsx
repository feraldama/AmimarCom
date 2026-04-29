import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

interface CajaTipo {
  id: string | number;
  CajaTipoId: string | number;
  CajaTipoDescripcion: string;
  [key: string]: unknown;
}


interface CajaTipoListProps {
  cajaTipos: CajaTipo[];
  onDelete?: (item: CajaTipo) => void;
  onEdit?: (item: CajaTipo) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCajaTipo?: CajaTipo | null;
  onSubmit: (formData: CajaTipo) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function CajaTipoList({
  cajaTipos,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentCajaTipo,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: CajaTipoListProps) {
  const [formData, setFormData] = useState({
    id: "",
    CajaTipoId: "",
    CajaTipoDescripcion: "",
  });

  useEffect(() => {
    if (currentCajaTipo) {
      setFormData({
        id: String(currentCajaTipo.id ?? currentCajaTipo.CajaTipoId),
        CajaTipoId: String(currentCajaTipo.CajaTipoId),
        CajaTipoDescripcion: currentCajaTipo.CajaTipoDescripcion,
      });
    } else {
      setFormData({
        id: "",
        CajaTipoId: "",
        CajaTipoDescripcion: "",
      });
    }
  }, [currentCajaTipo]);

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

  const formId = "cajatipo-form";

  const columns = [
    { key: "CajaTipoId", label: "ID" },
    { key: "CajaTipoDescripcion", label: "Descripción" },
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
            placeholder="Buscar tipos de caja"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Tipo de Caja"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<CajaTipo>
        columns={columns}
        data={cajaTipos}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron tipos de caja"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentCajaTipo
            ? `Editar tipo de caja: ${currentCajaTipo.CajaTipoId}`
            : "Crear nuevo tipo de caja"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentCajaTipo ? "Actualizar" : "Crear"}
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
                htmlFor="CajaTipoDescripcion"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Descripción
              </label>
              <input
                type="text"
                name="CajaTipoDescripcion"
                id="CajaTipoDescripcion"
                value={formData.CajaTipoDescripcion}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  handleInputChange({
                    target: {
                      name: "CajaTipoDescripcion",
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
