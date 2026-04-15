import { Plus } from "lucide-react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import ClienteFormModal from "../common/ClienteFormModal";
import { useAuth } from "../../contexts/useAuth";
import type { Cliente, ClienteWithId } from "../../types/cliente.types";

interface Pagination {
  totalItems: number;
}

interface CustomersListProps {
  clientes: ClienteWithId[];
  onDelete?: (item: ClienteWithId) => void;
  onEdit?: (item: ClienteWithId) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCliente?: Cliente | null;
  onSubmit: (formData: Cliente) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function CustomersList({
  clientes,
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
  currentCliente,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: CustomersListProps) {
  const { user } = useAuth();

  const columns = [
    { key: "ClienteId", label: "ID" },
    { key: "ClienteRUC", label: "RUC" },
    { key: "ClienteNombre", label: "Nombre" },
    { key: "ClienteApellido", label: "Apellido" },
    { key: "ClienteDireccion", label: "Dirección" },
    { key: "ClienteTelefono", label: "Teléfono" },
    { key: "ClienteCodJSI", label: "Cod. JSI" },
    { key: "UsuarioId", label: "Usuario" },
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
            placeholder="Buscar clientes"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Cliente"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<ClienteWithId>
        columns={columns}
        data={clientes}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron clientes"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <ClienteFormModal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        currentCliente={currentCliente}
        onSubmit={onSubmit}
        showCodJSI={true}
        defaultUserId={user?.id || ""}
      />
    </>
  );
}
