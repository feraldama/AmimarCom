import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import CajaGastosList from "./CajaGastosList";
import { formatMiles, formatMilesSmart } from "../../utils/utils";
import { getAllCajaTipos } from "../../services/cajatipo.service";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number | string;
  CajaGastoCantidad: number;
  CajaTipoId?: number | null;
  [key: string]: unknown;
}

interface CajaTipo {
  CajaTipoId: number;
  CajaTipoDescripcion: string;
}


interface CajasListProps {
  cajas: Caja[];
  onDelete?: (item: Caja) => void;
  onEdit?: (item: Caja) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCaja?: Caja | null;
  onSubmit: (formData: Caja) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  cajaTipoId?: number | null;
  onCajaTipoFilter?: (tipoId: number | null) => void;
}

export default function CajasList({
  cajas,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentCaja,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
  cajaTipoId,
  onCajaTipoFilter,
}: CajasListProps) {
  const [formData, setFormData] = useState({
    id: "",
    CajaId: "",
    CajaDescripcion: "",
    CajaMonto: 0,
    CajaGastoCantidad: 0,
    CajaTipoId: null as number | null,
  });
  // Buffer local del input Monto: deja escribir/borrar sin re-formatear en
  // cada tecla. Se sincroniza con formData.CajaMonto en onChange y se
  // re-formatea bonito en onBlur.
  const [montoInput, setMontoInput] = useState("0");
  const [cajaTipos, setCajaTipos] = useState<CajaTipo[]>([]);

  const parseMontoInput = (text: string): number => {
    let raw = text.replace(/\s/g, "").replace(/\./g, "");
    const isNegative = raw.startsWith("-");
    if (isNegative) raw = raw.substring(1);
    raw = raw.replace(/,/g, ".");
    const num = parseFloat(raw);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  };

  useEffect(() => {
    const loadCajaTipos = async () => {
      try {
        const tipos = await getAllCajaTipos();
        setCajaTipos(tipos);
      } catch (error) {
        console.error("Error al cargar tipos de caja:", error);
      }
    };
    loadCajaTipos();
  }, []);

  useEffect(() => {
    if (currentCaja) {
      // Convertir CajaMonto igual que en la tabla: Number() maneja correctamente strings con punto decimal
      const monto = Number(currentCaja.CajaMonto);
      setFormData({
        id: String(currentCaja.id ?? currentCaja.CajaId),
        CajaId: String(currentCaja.CajaId),
        CajaDescripcion: currentCaja.CajaDescripcion,
        CajaMonto: monto,
        CajaGastoCantidad: currentCaja.CajaGastoCantidad,
        CajaTipoId: currentCaja.CajaTipoId || null,
      });
      setMontoInput(formatMilesSmart(monto));
    } else {
      setFormData({
        id: "",
        CajaId: "",
        CajaDescripcion: "",
        CajaMonto: 0,
        CajaGastoCantidad: 0,
        CajaTipoId: null,
      });
      setMontoInput("0");
    }
  }, [currentCaja]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "CajaMonto" || name === "CajaGastoCantidad"
          ? Number(value)
          : name === "CajaTipoId"
          ? value === "" || value === "null"
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.CajaTipoId) {
      alert("Debe seleccionar un tipo de caja");
      return;
    }
    onSubmit(formData);
  };

  const cajaFormId = "caja-form";

  const columns = [
    { key: "CajaId", label: "ID" },
    { key: "CajaDescripcion", label: "Descripción" },
    {
      key: "CajaMonto",
      label: "Monto",
      render: (caja: Caja) => {
        // DIVISAS (TipoId=3): mostrar decimales sólo si los hay (formatMilesSmart).
        // Otros tipos: enteros con separador de miles.
        const monto = Number(caja.CajaMonto);
        if (caja.CajaTipoId === 3) {
          return `Gs. ${formatMilesSmart(monto)}`;
        }
        return `Gs. ${formatMiles(monto)}`;
      },
    },
    {
      key: "CajaTipoId",
      label: "Tipo de Caja",
      render: (caja: Caja) => {
        const tipo = cajaTipos.find((t) => t.CajaTipoId === caja.CajaTipoId);
        return tipo ? tipo.CajaTipoDescripcion : "-";
      },
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
            placeholder="Buscar cajas"
          />
        </div>
        {onCajaTipoFilter && (
          <div className="flex items-center gap-2">
            <select
              value={cajaTipoId || ""}
              onChange={(e) => {
                const value = e.target.value;
                onCajaTipoFilter(value === "" ? null : Number(value));
              }}
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block p-2.5 h-[42px]"
            >
              <option value="">Todos los tipos</option>
              {cajaTipos
                .sort((a, b) =>
                  a.CajaTipoDescripcion.localeCompare(
                    b.CajaTipoDescripcion
                  )
                )
                .map((tipo) => (
                  <option key={tipo.CajaTipoId} value={tipo.CajaTipoId}>
                    {tipo.CajaTipoDescripcion}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nueva Caja"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Caja>
        columns={columns}
        data={cajas}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron cajas"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentCaja
            ? `Editar caja: ${currentCaja.CajaId}`
            : "Crear nueva caja"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentCaja ? "Actualizar" : "Crear"}
              type="submit"
              form={cajaFormId}
            />
            <ActionButton
              label="Cancelar"
              variant="secondary"
              onClick={onCloseModal}
            />
          </>
        }
      >
        <form id={cajaFormId} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-6 gap-6">
            <div className="col-span-6 sm:col-span-3">
              <label
                htmlFor="CajaDescripcion"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Descripción
              </label>
              <input
                type="text"
                name="CajaDescripcion"
                id="CajaDescripcion"
                value={formData.CajaDescripcion}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  handleInputChange({
                    target: {
                      name: "CajaDescripcion",
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
                htmlFor="CajaMonto"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Monto
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="CajaMonto"
                id="CajaMonto"
                value={montoInput}
                onChange={(e) => {
                  const text = e.target.value;
                  setMontoInput(text);
                  setFormData((prev) => ({
                    ...prev,
                    CajaMonto: parseMontoInput(text),
                  }));
                }}
                onBlur={() => {
                  setMontoInput(formatMilesSmart(formData.CajaMonto));
                }}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                required
              />
            </div>
            <div className="col-span-6 sm:col-span-3">
              <label
                htmlFor="CajaTipoId"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Tipo de Caja <span className="text-destructive">*</span>
              </label>
              <select
                name="CajaTipoId"
                id="CajaTipoId"
                value={formData.CajaTipoId || ""}
                onChange={handleInputChange}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                required
              >
                <option value="">Seleccione un tipo</option>
                {cajaTipos
                  .sort((a, b) =>
                    a.CajaTipoDescripcion.localeCompare(
                      b.CajaTipoDescripcion
                    )
                  )
                  .map((tipo) => (
                    <option key={tipo.CajaTipoId} value={tipo.CajaTipoId}>
                      {tipo.CajaTipoDescripcion}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </form>
        {currentCaja && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-2">
              Gastos asignados a la caja
            </h4>
            <CajaGastosList cajaId={currentCaja.CajaId} />
          </div>
        )}
      </Modal>
    </>
  );
}
