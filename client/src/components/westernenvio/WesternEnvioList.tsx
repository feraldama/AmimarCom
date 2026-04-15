import { Plus } from "lucide-react";
import { useState, useEffect } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import { getCajas } from "../../services/cajas.service";
import { getTiposGasto } from "../../services/tipogasto.service";
import { getTiposGastoGrupo } from "../../services/tipogastogrupo.service";
import { formatMiles, formatMilesWithDecimals } from "../../utils/utils";

export interface WesternEnvio {
  id: string | number;
  WesternEnvioId: string | number;
  CajaId: string | number;
  WesternEnvioFecha: string;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  WesternEnvioCambio: number;
  WesternEnvioDetalle: string;
  WesternEnvioMTCN: number;
  WesternEnvioCargoEnvio: number;
  WesternEnvioFactura: string;
  WesternEnvioTimbrado: string;
  WesternEnvioMonto: number;
  WesternEnvioUsuarioId: string | number;
  ClienteId?: string | number;
  CajaDescripcion?: string;
  TipoGastoDescripcion?: string;
  TipoGastoGrupoDescripcion?: string;
  UsuarioNombre?: string;
  [key: string]: unknown;
}

interface Caja {
  CajaId: number;
  CajaDescripcion: string;
  CajaMonto?: number;
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

interface Pagination {
  totalItems: number;
}

interface WesternEnvioListProps {
  envios: WesternEnvio[];
  onDelete?: (item: WesternEnvio) => void | Promise<void>;
  onEdit?: (item: WesternEnvio) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  isModalOpen?: boolean;
  onCloseModal: () => void;
  currentEnvio?: WesternEnvio | null;
  onSubmit: (formData: WesternEnvio) => void | Promise<void>;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
  disableEdit?: boolean;
}

export default function WesternEnvioList({
  envios = [],
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
  currentEnvio,
  onSubmit,
  disableEdit,
}: WesternEnvioListProps) {
  const [formData, setFormData] = useState<WesternEnvio>({
    WesternEnvioId: "",
    CajaId: "",
    WesternEnvioFecha: "",
    TipoGastoId: 2, // Fijo en 2 para envíos
    TipoGastoGrupoId: "",
    WesternEnvioCambio: 0,
    WesternEnvioDetalle: "",
    WesternEnvioMTCN: 0,
    WesternEnvioCargoEnvio: 0,
    WesternEnvioFactura: "",
    WesternEnvioTimbrado: "",
    WesternEnvioMonto: 0,
    WesternEnvioUsuarioId: "",
    ClienteId: "",
    id: "",
  });

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [tiposGasto, setTiposGasto] = useState<TipoGasto[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupo[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cajasResponse, tiposGastoData, tiposGastoGrupoData] =
          await Promise.all([
            getCajas(1, 1000),
            getTiposGasto(),
            getTiposGastoGrupo(),
          ]);
        setCajas(cajasResponse.data || []);
        setTiposGasto(tiposGastoData);
        setTiposGastoGrupo(tiposGastoGrupoData);
      } catch (error) {
        console.error("Error al obtener datos:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (currentEnvio) {
      // Formatear fecha para input datetime-local
      const fecha = currentEnvio.WesternEnvioFecha
        ? new Date(currentEnvio.WesternEnvioFecha)
            .toISOString()
            .slice(0, 16)
        : "";
      setFormData({
        ...currentEnvio,
        WesternEnvioFecha: fecha,
      });
    } else {
      // Resetear formulario
      const fechaActual = new Date().toISOString().slice(0, 16);
      setFormData({
        WesternEnvioId: "",
        CajaId: "",
        WesternEnvioFecha: fechaActual,
        TipoGastoId: 2,
        TipoGastoGrupoId: "",
        WesternEnvioCambio: 0,
        WesternEnvioDetalle: "",
        WesternEnvioMTCN: 0,
        WesternEnvioCargoEnvio: 0,
        WesternEnvioFactura: "",
        WesternEnvioTimbrado: "",
        WesternEnvioMonto: 0,
        WesternEnvioUsuarioId: "",
        id: "",
      });
    }
  }, [currentEnvio, isModalOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "WesternEnvioMonto" ||
        name === "WesternEnvioCambio" ||
        name === "WesternEnvioMTCN" ||
        name === "WesternEnvioCargoEnvio" ||
        name === "CajaId" ||
        name === "TipoGastoId" ||
        name === "TipoGastoGrupoId"
          ? value === "" ? "" : Number(value)
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Convertir fecha a formato ISO para el backend
    const fechaISO = formData.WesternEnvioFecha
      ? new Date(formData.WesternEnvioFecha).toISOString()
      : new Date().toISOString();
    
    onSubmit({
      ...formData,
      WesternEnvioFecha: fechaISO,
      CajaId: Number(formData.CajaId),
      TipoGastoId: Number(formData.TipoGastoId),
      TipoGastoGrupoId: Number(formData.TipoGastoGrupoId),
      WesternEnvioMonto: Number(formData.WesternEnvioMonto),
      WesternEnvioCambio: Number(formData.WesternEnvioCambio) || 0,
      WesternEnvioMTCN: Number(formData.WesternEnvioMTCN) || 0,
      WesternEnvioCargoEnvio: Number(formData.WesternEnvioCargoEnvio) || 0,
      ClienteId: formData.ClienteId && formData.ClienteId !== "" 
        ? Number(formData.ClienteId) 
        : undefined,
    });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseModal();
    }
  };

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

  // Filtrar grupos: solo los que tienen TipoGastoId = 2 y "western" en la descripción
  const gruposFiltrados = tiposGastoGrupo
    .filter(
      (g) =>
        g.TipoGastoId === 2 &&
        g.TipoGastoGrupoDescripcion.toLowerCase().includes("western")
    )
    .sort((a, b) =>
      a.TipoGastoGrupoDescripcion.localeCompare(b.TipoGastoGrupoDescripcion)
    );

  // Configuración de columnas para la tabla
  const columns = [
    {
      key: "WesternEnvioId",
      label: "ID",
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
    },
    {
      key: "WesternEnvioFecha",
      label: "Fecha",
      render: (row: WesternEnvio) => formatDate(row.WesternEnvioFecha),
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
      key: "WesternEnvioDetalle",
      label: "Detalle",
    },
    {
      key: "WesternEnvioMTCN",
      label: "MTCN",
    },
    {
      key: "WesternEnvioCargoEnvio",
      label: "Cargo Envío",
      render: (item: WesternEnvio) =>
        `Gs. ${formatMiles(item.WesternEnvioCargoEnvio || 0)}`,
    },
    {
      key: "WesternEnvioCambio",
      label: "Cambio",
      render: (item: WesternEnvio) =>
        `Gs. ${formatMilesWithDecimals(item.WesternEnvioCambio || 0)}`,
    },
    {
      key: "WesternEnvioMonto",
      label: "Monto",
      render: (item: WesternEnvio) =>
        `Gs. ${formatMiles(item.WesternEnvioMonto || 0)}`,
    },
    {
      key: "WesternEnvioUsuarioId",
      label: "Usuario",
    },
    {
      key: "ClienteId",
      label: "Cliente ID",
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
            placeholder="Buscar envíos western..."
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Envío Western"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>

      <DataTable<WesternEnvio>
        columns={columns}
        data={envios}
        onEdit={disableEdit ? undefined : onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron envíos western"
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
          <div className="relative w-full max-w-4xl max-h-full z-10">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentEnvio
                    ? `Editar envío: ${currentEnvio.WesternEnvioId}`
                    : "Crear nuevo envío western"}
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
                      htmlFor="CajaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Caja <span className="text-destructive">*</span>
                    </label>
                    <select
                      name="CajaId"
                      id="CajaId"
                      value={formData.CajaId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {cajas
                        .sort((a, b) =>
                          a.CajaDescripcion.localeCompare(b.CajaDescripcion)
                        )
                        .map((c) => (
                          <option key={c.CajaId} value={c.CajaId}>
                            {c.CajaDescripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioFecha"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Fecha <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      name="WesternEnvioFecha"
                      id="WesternEnvioFecha"
                      value={formData.WesternEnvioFecha}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TipoGastoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo Gasto
                    </label>
                    <input
                      type="text"
                      value={
                        tiposGasto.find(
                          (tg) => tg.TipoGastoId === formData.TipoGastoId
                        )?.TipoGastoDescripcion || ""
                      }
                      readOnly
                      disabled
                      className="bg-gray-100 border border-gray-300 text-gray-600 text-sm rounded-lg block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="TipoGastoGrupoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Grupo Gasto <span className="text-destructive">*</span>
                    </label>
                    <select
                      name="TipoGastoGrupoId"
                      id="TipoGastoGrupoId"
                      value={formData.TipoGastoGrupoId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {gruposFiltrados.map((gg) => (
                        <option key={gg.TipoGastoGrupoId} value={gg.TipoGastoGrupoId}>
                          {gg.TipoGastoGrupoDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      name="WesternEnvioMonto"
                      id="WesternEnvioMonto"
                      value={
                        formData.WesternEnvioMonto !== undefined &&
                        formData.WesternEnvioMonto !== null
                          ? formatMiles(formData.WesternEnvioMonto)
                          : "0"
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\s/g, "")
                          .replace(/\./g, "");
                        const num = parseFloat(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            WesternEnvioMonto: num,
                          }));
                        } else if (raw === "") {
                          setFormData((prev) => ({ ...prev, WesternEnvioMonto: 0 }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioCambio"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cambio Dolar
                    </label>
                    <input
                      type="text"
                      name="WesternEnvioCambio"
                      id="WesternEnvioCambio"
                      value={
                        formData.WesternEnvioCambio !== undefined &&
                        formData.WesternEnvioCambio !== null
                          ? formatMilesWithDecimals(formData.WesternEnvioCambio)
                          : "0"
                      }
                      onChange={(e) => {
                        let raw = e.target.value
                          .replace(/\s/g, "")
                          .replace(/\./g, "");
                        raw = raw.replace(/,/g, ".");
                        const num = parseFloat(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            WesternEnvioCambio: num,
                          }));
                        } else if (raw === "") {
                          setFormData((prev) => ({ ...prev, WesternEnvioCambio: 0 }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioMTCN"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      MTCN
                    </label>
                    <input
                      type="number"
                      name="WesternEnvioMTCN"
                      id="WesternEnvioMTCN"
                      value={formData.WesternEnvioMTCN || 0}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioCargoEnvio"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cargo Envío
                    </label>
                    <input
                      type="text"
                      name="WesternEnvioCargoEnvio"
                      id="WesternEnvioCargoEnvio"
                      value={
                        formData.WesternEnvioCargoEnvio !== undefined &&
                        formData.WesternEnvioCargoEnvio !== null
                          ? formatMiles(formData.WesternEnvioCargoEnvio)
                          : "0"
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\s/g, "")
                          .replace(/\./g, "");
                        const num = parseFloat(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            WesternEnvioCargoEnvio: num,
                          }));
                        } else if (raw === "") {
                          setFormData((prev) => ({ ...prev, WesternEnvioCargoEnvio: 0 }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioFactura"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Factura
                    </label>
                    <input
                      type="text"
                      name="WesternEnvioFactura"
                      id="WesternEnvioFactura"
                      value={formData.WesternEnvioFactura || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="WesternEnvioTimbrado"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Timbrado
                    </label>
                    <input
                      type="text"
                      name="WesternEnvioTimbrado"
                      id="WesternEnvioTimbrado"
                      value={formData.WesternEnvioTimbrado || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6">
                    <label
                      htmlFor="WesternEnvioDetalle"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Detalle <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      name="WesternEnvioDetalle"
                      id="WesternEnvioDetalle"
                      value={formData.WesternEnvioDetalle}
                      onChange={handleInputChange}
                      rows={3}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ClienteId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cliente ID
                    </label>
                    <input
                      type="number"
                      name="ClienteId"
                      id="ClienteId"
                      value={formData.ClienteId || ""}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentEnvio ? "Actualizar" : "Crear"}
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
