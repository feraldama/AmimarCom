import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import type { JSICobro } from "../../services/jsicobro.service";
import { getCajas } from "../../services/cajas.service";
import { getAllClientesSinPaginacion } from "../../services/clientes.service";
import type { Cliente } from "../../types/cliente.types";

interface Caja {
  CajaId?: number;
  CajaDescripcion?: string;
  CajaMonto?: number;
  CajaTipoId?: number;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
}

interface JSICobroWithId extends JSICobro {
  id: string | number;
  [key: string]: unknown;
}

interface JSICobroListProps {
  jsicobros: JSICobro[];
  onDelete?: (item: JSICobro) => void;
  onEdit?: (item: JSICobro) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  isModalOpen?: boolean;
  onCloseModal: () => void;
  currentJSICobro?: JSICobro | null;
  onSubmit: (formData: JSICobro) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  disableEdit?: boolean;
}

export default function JSICobroList({
  jsicobros = [],
  onDelete,
  onEdit,
  onCreate,
  pagination,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  sortKey,
  sortOrder,
  onSort,
  isModalOpen,
  onCloseModal,
  currentJSICobro,
  onSubmit,
  disableEdit,
}: JSICobroListProps) {
  const [formData, setFormData] = useState<JSICobro>({
    JSICobroId: undefined,
    CajaId: undefined,
    JSICobroFecha: "",
    JSICobroCod: "",
    ClienteId: undefined,
    JSICobroMonto: 0,
    JSICobroUsuarioId: undefined,
  });

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cajasData, clientesData] = await Promise.all([
          getCajas(1, 1000),
          getAllClientesSinPaginacion(),
        ]);
        setCajas(cajasData.data || []);
        setClientes(clientesData.data || []);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (currentJSICobro) {
      setFormData({
        JSICobroId: currentJSICobro.JSICobroId,
        CajaId: currentJSICobro.CajaId,
        JSICobroFecha: currentJSICobro.JSICobroFecha
          ? new Date(currentJSICobro.JSICobroFecha).toISOString().slice(0, 16)
          : "",
        JSICobroCod: currentJSICobro.JSICobroCod || "",
        ClienteId: currentJSICobro.ClienteId,
        JSICobroMonto: currentJSICobro.JSICobroMonto || 0,
        JSICobroUsuarioId: currentJSICobro.JSICobroUsuarioId,
      });
    } else {
      // Inicializar con fecha actual
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hh = String(hoy.getHours()).padStart(2, "0");
      const min = String(hoy.getMinutes()).padStart(2, "0");
      setFormData({
        JSICobroId: undefined,
        CajaId: undefined,
        JSICobroFecha: `${yyyy}-${mm}-${dd}T${hh}:${min}`,
        JSICobroCod: "",
        ClienteId: undefined,
        JSICobroMonto: 0,
        JSICobroUsuarioId: undefined,
      });
    }
  }, [currentJSICobro, isModalOpen]);

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

  // Formatear monto
  const formatAmount = (amount: number) => {
    if (!amount) return "Gs. 0";
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      currencyDisplay: "code",
    })
      .format(amount)
      .replace("PYG", "Gs.");
  };

  // Formatear monto para input
  const formatMiles = (num: number) => {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Configuración de columnas para la tabla
  const columns = [
    {
      key: "JSICobroId",
      label: "ID",
    },
    {
      key: "JSICobroFecha",
      label: "Fecha",
      render: (row: JSICobro) => formatDate(row.JSICobroFecha || ""),
    },
    {
      key: "JSICobroCod",
      label: "Código",
    },
    {
      key: "ClienteNombre",
      label: "Cliente",
      render: (row: JSICobro) => {
        const nombre = row.ClienteNombre || "";
        const apellido = row.ClienteApellido || "";
        return nombre && apellido
          ? `${nombre} ${apellido}`
          : nombre || apellido || "-";
      },
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
    },
    {
      key: "JSICobroMonto",
      label: "Monto",
      render: (item: JSICobro) => formatAmount(item.JSICobroMonto || 0),
    },
    {
      key: "JSICobroUsuarioId",
      label: "Usuario",
      render: (item: JSICobro) => item.JSICobroUsuarioId || "-",
    },
  ];

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (event.target === event.currentTarget) {
      onCloseModal();
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, "").replace(/\./g, "");
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      setFormData((prev) => ({
        ...prev,
        JSICobroMonto: num,
      }));
    } else if (raw === "") {
      setFormData((prev) => ({ ...prev, JSICobroMonto: 0 }));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(formData);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar cobros de JSI..."
          />
        </div>
        <div className="py-4">
          <ActionButton
            label="Nuevo Cobro"
            onClick={onCreate}
            icon={Plus}
          />
        </div>
      </div>

      <DataTable<JSICobroWithId>
        columns={columns}
        data={jsicobros.map((cobro) => ({
          ...cobro,
          id: cobro.id || cobro.JSICobroId || 0,
        }))}
        onEdit={disableEdit ? undefined : onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron cobros de JSI"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleBackdropClick}
        >
          <div className="absolute inset-0 bg-black opacity-50" />
          <div className="relative w-full max-w-2xl max-h-full z-10">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentJSICobro
                    ? `Editar cobro JSI: ${currentJSICobro.JSICobroId}`
                    : "Crear nuevo cobro JSI"}
                </h3>
                <button
                  type="button"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center"
                  onClick={onCloseModal}
                >
                  <svg
                    className="size-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="JSICobroFecha"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Fecha <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      name="JSICobroFecha"
                      id="JSICobroFecha"
                      value={formData.JSICobroFecha || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="JSICobroCod"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Código
                    </label>
                    <input
                      type="text"
                      name="JSICobroCod"
                      id="JSICobroCod"
                      value={formData.JSICobroCod || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="CajaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Caja <span className="text-destructive">*</span>
                    </label>
                    <select
                      name="CajaId"
                      id="CajaId"
                      value={formData.CajaId || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    >
                      <option value="">Seleccione una caja</option>
                      {cajas
                        .sort((a, b) =>
                          (a.CajaDescripcion || "").localeCompare(
                            b.CajaDescripcion || ""
                          )
                        )
                        .map((caja) => (
                          <option key={caja.CajaId} value={caja.CajaId}>
                            {caja.CajaDescripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ClienteId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cliente
                    </label>
                    <select
                      name="ClienteId"
                      id="ClienteId"
                      value={formData.ClienteId || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione un cliente</option>
                      {clientes
                        .sort((a, b) => {
                          const nombreA = `${a.ClienteNombre || ""} ${
                            a.ClienteApellido || ""
                          }`.trim();
                          const nombreB = `${b.ClienteNombre || ""} ${
                            b.ClienteApellido || ""
                          }`.trim();
                          return nombreA.localeCompare(nombreB);
                        })
                        .map((cliente) => (
                          <option
                            key={cliente.ClienteId}
                            value={cliente.ClienteId}
                          >
                            {cliente.ClienteNombre} {cliente.ClienteApellido}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="JSICobroMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="JSICobroMonto"
                      id="JSICobroMonto"
                      value={formatMiles(formData.JSICobroMonto || 0)}
                      onChange={handleMontoChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentJSICobro ? "Actualizar" : "Crear"}
                  type="submit"
                />
                <ActionButton
                  label="Cancelar"
                  variant="secondary"
                  onClick={onCloseModal}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
