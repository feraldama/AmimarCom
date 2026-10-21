import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
  // Por qué no se puede corregir (null si se puede); lo calcula el backend
  MotivoNoCorregible?: string | null;
  // Por qué no se puede eliminar desde acá (null si se puede)
  MotivoNoEliminable?: string | null;
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
  // Corrección: sólo monto y detalle (el movimiento conserva caja, tipo y turno)
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setMonto(
      currentMovement ? String(Number(currentMovement.RegistroDiarioCajaMonto)) : ""
    );
    setDetalle(currentMovement?.RegistroDiarioCajaDetalle || "");
    setMotivo("");
  }, [currentMovement]);

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

  // Formatear monto. Muestra hasta 2 decimales solo si el valor los tiene
  // (los montos en guaraníes se ven enteros; las divisas conservan decimales).
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      currencyDisplay: "code", // Muestra "PYG"
    })
      .format(Number(amount))
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
      onSubmit({
        ...currentMovement,
        RegistroDiarioCajaMonto: Number(monto),
        RegistroDiarioCajaDetalle: detalle,
        Motivo: motivo,
      });
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
        editDisabledReason={(m) => m.MotivoNoCorregible}
        deleteDisabledReason={(m) => m.MotivoNoEliminable}
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
          currentMovement ? "Corregir movimiento" : "Crear nuevo movimiento"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentMovement ? "Corregir" : "Crear"}
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
          {currentMovement && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Caja: </span>
                  {currentMovement.CajaDescripcion}
                </div>
                <div>
                  <span className="text-gray-500">Fecha: </span>
                  {formatDate(currentMovement.RegistroDiarioCajaFecha)}
                </div>
                <div>
                  <span className="text-gray-500">Tipo: </span>
                  {currentMovement.TipoGastoDescripcion}
                </div>
                <div>
                  <span className="text-gray-500">Grupo: </span>
                  {currentMovement.TipoGastoGrupoDescripcion}
                </div>
              </div>
              <p className="text-sm text-gray-600">
                El movimiento conserva su turno. Si es de un cierre anterior, se
                recalcula la diferencia de ese cierre y la caja del turno en
                curso no cambia.
              </p>
              <div>
                <label
                  htmlFor="RegistroDiarioCajaMonto"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Monto
                </label>
                <input
                  type="number"
                  id="RegistroDiarioCajaMonto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  min="0"
                  step="any"
                  required
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                />
              </div>
              <div>
                <label
                  htmlFor="RegistroDiarioCajaDetalle"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Descripción
                </label>
                <input
                  type="text"
                  id="RegistroDiarioCajaDetalle"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                />
              </div>
              <div>
                <label
                  htmlFor="MotivoCorreccion"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Motivo de la corrección
                </label>
                <textarea
                  id="MotivoCorreccion"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  rows={2}
                  required
                  placeholder="Ej.: se cargó 100.000 y el cliente pagó 150.000"
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                />
              </div>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
