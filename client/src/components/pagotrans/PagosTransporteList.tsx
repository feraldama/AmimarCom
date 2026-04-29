import { Plus } from "lucide-react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import type { PagoTrans } from "../../services/pagotrans.service";

interface PagoTransWithId extends PagoTrans {
  id: string | number;
  [key: string]: unknown;
}

interface PagosTransporteListProps {
  pagosTrans: PagoTrans[];
  onDelete?: (item: PagoTrans) => void;
  onEdit?: (item: PagoTrans) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  isModalOpen?: boolean;
  onCloseModal: () => void;
  currentPagoTrans?: PagoTrans | null;
  onSubmit: (formData: PagoTrans) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  disableEdit?: boolean;
}

export default function PagosTransporteList({
  pagosTrans = [],
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
  currentPagoTrans,
  onSubmit,
  disableEdit,
}: PagosTransporteListProps) {
  // Formatear fecha
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Formatear fecha sin hora
  const formatDateOnly = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Formatear monto
  const formatAmount = (amount: number) => {
    if (!amount) return "Gs. 0";
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
      key: "PagoTransId",
      label: "ID",
    },
    {
      key: "PagoTransFecha",
      label: "Fecha",
      render: (row: PagoTrans) => formatDate(row.PagoTransFecha || ""),
    },
    {
      key: "TransporteNombre",
      label: "Transporte",
    },
    {
      key: "PagoTransOrigen",
      label: "Origen/Destino",
      render: (row: PagoTrans) => {
        const origen = row.PagoTransOrigen || "";
        const destino = row.PagoTransDestino || "";
        return destino ? `${origen} - ${destino}` : origen;
      },
    },
    {
      key: "PagoTransFechaEmbarque",
      label: "Fecha/Hora Embarque",
      render: (row: PagoTrans) => {
        const fecha = row.PagoTransFechaEmbarque
          ? formatDateOnly(row.PagoTransFechaEmbarque)
          : "-";
        const hora = row.PagoTransHora || "";
        return hora ? `${fecha} ${hora}` : fecha;
      },
    },
    {
      key: "PagoTransAsiento",
      label: "Asiento",
    },
    {
      key: "PagoTransNumeroBoleto",
      label: "N° Boleto",
    },
    {
      key: "PagoTransNombreApellido",
      label: "Nombre/Apellido",
    },
    {
      key: "PagoTransClienteRUC",
      label: "RUC",
    },
    {
      key: "PagoTransTelefono",
      label: "Teléfono",
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
    },
    {
      key: "PagoTransMonto",
      label: "Monto",
      render: (item: PagoTrans) => formatAmount(item.PagoTransMonto || 0),
    },
    {
      key: "PagoTransUsuarioId",
      label: "Usuario",
      render: (item: PagoTrans) => item.PagoTransUsuarioId || "-",
    },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentPagoTrans) {
      onSubmit(currentPagoTrans);
    }
  };

  const formId = "pagotrans-form";

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar pagos de transporte..."
          />
        </div>
        <div className="py-4">
          <ActionButton label="Nuevo Pago" onClick={onCreate} icon={Plus} />
        </div>
      </div>

      <DataTable<PagoTransWithId>
        columns={columns}
        data={pagosTrans.map((pago) => ({
          ...pago,
          id: pago.id || pago.PagoTransId || 0,
        }))}
        onEdit={disableEdit ? undefined : onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron pagos de transporte"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />

      <Modal
        isOpen={!!isModalOpen}
        onClose={onCloseModal}
        title={
          currentPagoTrans
            ? "Editar pago de transporte"
            : "Crear nuevo pago de transporte"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentPagoTrans ? "Actualizar" : "Crear"}
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
