import { Plus } from "lucide-react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

export interface Movimiento {
  id: string | number;
  RegistroDiarioCajaId: string | number;
  RegistroDiarioCajaFecha: string;
  RegistroDiarioCajaDetalle: string;
  RegistroDiarioCajaMonto: number;
  UsuarioId: string | number;
  CajaId: string | number;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  CajaDescripcion: string;
  TipoGastoDescripcion: string;
  TipoGastoGrupoDescripcion: string;
  RegistroDiarioCajaMTCN: string;
  RegistroDiarioCajaCargoEnvio: number;
  RegistroDiarioCajaCambio: number;
  [key: string]: unknown;
}

interface MovementsListProps {
  movimientos: Movimiento[];
  onDelete?: (item: Movimiento) => void | Promise<void>;
  onEdit?: (item: Movimiento) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  isModalOpen?: boolean;
  onCloseModal: () => void;
  currentMovement?: Movimiento | null;
  onSubmit: (formData: Movimiento) => void | Promise<void>;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  disableEdit?: boolean;
}

export default function MovementsList({
  movimientos = [],
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  sortKey,
  sortOrder,
  onSort,
  isModalOpen,
  onCloseModal,
  currentMovement,
  onSubmit,
  disableEdit,
}: MovementsListProps) {
  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formatear monto
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      currencyDisplay: "code", // Muestra "PYG"
    })
      .format(amount)
      .replace("PYG", "Gs."); // Reemplaza "PYG" con "Gs."
  };

  // Configuración de columnas para la tabla
  const columns = [
    {
      key: "RegistroDiarioCajaId",
      label: "ID",
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
    },
    {
      key: "RegistroDiarioCajaFecha",
      label: "Fecha",
      render: (row: Movimiento) => formatDate(row.RegistroDiarioCajaFecha),
    },
    {
      key: "TipoGastoDescripcion",
      label: "Tipo Gasto",
    },
    {
      key: "TipoGastoGrupoDescripcion",
      label: "Grupo Gasto",
    },
    {
      key: "RegistroDiarioCajaDetalle",
      label: "Descripción",
    },
    {
      key: "RegistroDiarioCajaMTCN",
      label: "MTCN",
    },
    {
      key: "RegistroDiarioCajaCargoEnvio",
      label: "Cargo Envío",
      render: (item: Movimiento) =>
        formatAmount(item.RegistroDiarioCajaCargoEnvio),
    },
    {
      key: "RegistroDiarioCajaMonto",
      label: "Monto",
      render: (item: Movimiento) => formatAmount(item.RegistroDiarioCajaMonto),
    },
    {
      key: "RegistroDiarioCajaCambio",
      label: "Cambio",
      render: (item: Movimiento) => formatAmount(item.RegistroDiarioCajaCambio),
    },
    {
      key: "UsuarioId",
      label: "Usuario",
    },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentMovement) {
      onSubmit(currentMovement);
    }
  };

  const formId = "movimiento-form";

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar registros..."
          />
        </div>
        <div className="py-4">
          <ActionButton
            label="Nuevo Registro"
            onClick={onCreate}
            icon={Plus}
          />
        </div>
      </div>

      <DataTable<Movimiento>
        columns={columns}
        data={movimientos}
        onEdit={disableEdit ? undefined : onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron registros"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />

      <Modal
        isOpen={!!isModalOpen}
        onClose={onCloseModal}
        title={
          currentMovement ? "Editar movimiento" : "Crear nuevo movimiento"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentMovement ? "Actualizar" : "Crear"}
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
        <form id={formId} onSubmit={handleSubmit} className="space-y-6" />
      </Modal>
    </>
  );
}
