import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";
import { formatMiles } from "../../utils/utils";
import { getCajas } from "../../services/cajas.service";
import { getUsuarios } from "../../services/usuarios.service";
import { getDivisas } from "../../services/divisa.service";
import { useAuth } from "../../contexts/useAuth";

interface DivisaMovimiento {
  id: string | number;
  DivisaMovimientoId: string | number;
  CajaId: number;
  DivisaMovimientoFecha: string;
  DivisaMovimientoTipo: string;
  DivisaId: number;
  DivisaMovimientoCambio: number;
  DivisaMovimientoCantidad: number;
  DivisaMovimientoMonto: number;
  UsuarioId: number;
  CajaDescripcion?: string;
  DivisaNombre?: string;
  UsuarioNombre?: string;
  [key: string]: unknown;
}

interface Caja {
  CajaId: number;
  CajaDescripcion: string;
}

interface Usuario {
  UsuarioId: number;
  UsuarioNombre: string;
}

interface Divisa {
  DivisaId: number;
  DivisaNombre: string;
  DivisaCompraMonto: number;
  DivisaVentaMonto: number;
}


interface DivisasMovimientosListProps {
  movimientos: DivisaMovimiento[];
  onDelete?: (item: DivisaMovimiento) => void;
  onEdit?: (item: DivisaMovimiento) => void;
  onCreate?: () => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentMovimiento?: DivisaMovimiento | null;
  onSubmit: (formData: DivisaMovimiento) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function DivisasMovimientosList({
  movimientos,
  onDelete,
  onEdit,
  onCreate,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentMovimiento,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: DivisasMovimientosListProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    id: "",
    DivisaMovimientoId: "",
    CajaId: "",
    DivisaMovimientoFecha: "",
    DivisaMovimientoTipo: "Compra",
    DivisaId: "",
    DivisaMovimientoCambio: 0,
    DivisaMovimientoCantidad: 0,
    DivisaMovimientoMonto: 0,
    UsuarioId: "",
  });

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [divisas, setDivisas] = useState<Divisa[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cajasData, usuariosData, divisasData] = await Promise.all([
          getCajas(1, 1000),
          getUsuarios(1, 1000),
          getDivisas(1, 1000),
        ]);
        setCajas(cajasData.data || []);
        setUsuarios(usuariosData.data || []);
        setDivisas(divisasData.data || []);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (currentMovimiento) {
      const fecha = currentMovimiento.DivisaMovimientoFecha
        ? new Date(currentMovimiento.DivisaMovimientoFecha)
            .toISOString()
            .split("T")[0]
        : "";
      setFormData({
        id: String(
          currentMovimiento.id ?? currentMovimiento.DivisaMovimientoId
        ),
        DivisaMovimientoId: String(currentMovimiento.DivisaMovimientoId),
        CajaId: currentMovimiento.CajaId
          ? String(currentMovimiento.CajaId)
          : "",
        DivisaMovimientoFecha: fecha,
        DivisaMovimientoTipo: currentMovimiento.DivisaMovimientoTipo || "C",
        DivisaId: currentMovimiento.DivisaId
          ? String(currentMovimiento.DivisaId)
          : "",
        DivisaMovimientoCambio:
          Number(currentMovimiento.DivisaMovimientoCambio) || 0,
        DivisaMovimientoCantidad:
          Number(currentMovimiento.DivisaMovimientoCantidad) || 0,
        DivisaMovimientoMonto:
          Number(currentMovimiento.DivisaMovimientoMonto) || 0,
        UsuarioId: currentMovimiento.UsuarioId
          ? String(currentMovimiento.UsuarioId)
          : "",
      });
    } else {
      const today = new Date().toISOString().split("T")[0];
      setFormData({
        id: "",
        DivisaMovimientoId: "",
        CajaId: "",
        DivisaMovimientoFecha: today,
        DivisaMovimientoTipo: "C",
        DivisaId: "",
        DivisaMovimientoCambio: 0,
        DivisaMovimientoCantidad: 0,
        DivisaMovimientoMonto: 0,
        UsuarioId: user?.id ? String(user.id) : "",
      });
    }
  }, [currentMovimiento, user]);

  // Calcular monto cuando cambian cantidad o cambio
  useEffect(() => {
    if (formData.DivisaMovimientoCantidad && formData.DivisaMovimientoCambio) {
      const monto =
        formData.DivisaMovimientoCantidad * formData.DivisaMovimientoCambio;
      setFormData((prev) => ({
        ...prev,
        DivisaMovimientoMonto: monto,
      }));
    }
  }, [formData.DivisaMovimientoCantidad, formData.DivisaMovimientoCambio]);

  // Actualizar cambio cuando cambia la divisa o el tipo
  useEffect(() => {
    if (formData.DivisaId) {
      const divisa = divisas.find(
        (d) => d.DivisaId === Number(formData.DivisaId)
      );
      if (divisa) {
        const cambio =
          formData.DivisaMovimientoTipo === "C"
            ? divisa.DivisaCompraMonto
            : divisa.DivisaVentaMonto;
        setFormData((prev) => ({
          ...prev,
          DivisaMovimientoCambio: cambio,
        }));
      }
    }
  }, [formData.DivisaId, formData.DivisaMovimientoTipo, divisas]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "DivisaMovimientoCambio" ||
        name === "DivisaMovimientoCantidad" ||
        name === "DivisaMovimientoMonto"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      CajaId: Number(formData.CajaId),
      DivisaId: Number(formData.DivisaId),
      UsuarioId: Number(formData.UsuarioId),
      DivisaMovimientoCambio: Number(formData.DivisaMovimientoCambio),
      DivisaMovimientoCantidad: Number(formData.DivisaMovimientoCantidad),
      DivisaMovimientoMonto: Number(formData.DivisaMovimientoMonto),
    });
  };

  const formId = "divisamov-form";

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const columns = [
    { key: "DivisaMovimientoId", label: "ID" },
    {
      key: "DivisaMovimientoFecha",
      label: "Fecha",
      render: (movimiento: DivisaMovimiento) =>
        formatDate(movimiento.DivisaMovimientoFecha),
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
      render: (movimiento: DivisaMovimiento) =>
        movimiento.CajaDescripcion || "",
    },
    {
      key: "DivisaNombre",
      label: "Divisa",
      render: (movimiento: DivisaMovimiento) => movimiento.DivisaNombre || "",
    },
    {
      key: "DivisaMovimientoTipo",
      label: "Tipo",
      render: (movimiento: DivisaMovimiento) =>
        movimiento.DivisaMovimientoTipo === "C"
          ? "Compra"
          : movimiento.DivisaMovimientoTipo === "V"
          ? "Venta"
          : movimiento.DivisaMovimientoTipo || "",
    },
    {
      key: "DivisaMovimientoCantidad",
      label: "Cantidad",
      render: (movimiento: DivisaMovimiento) =>
        formatMiles(Number(movimiento.DivisaMovimientoCantidad)),
    },
    {
      key: "DivisaMovimientoCambio",
      label: "Cambio",
      render: (movimiento: DivisaMovimiento) =>
        `Gs. ${formatMiles(Number(movimiento.DivisaMovimientoCambio))}`,
    },
    {
      key: "DivisaMovimientoMonto",
      label: "Monto",
      render: (movimiento: DivisaMovimiento) =>
        `Gs. ${formatMiles(Number(movimiento.DivisaMovimientoMonto))}`,
    },
    {
      key: "UsuarioId",
      label: "Usuario",
      render: (movimiento: DivisaMovimiento) => movimiento.UsuarioId || "",
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
            placeholder="Buscar movimientos de divisa"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Movimiento"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<DivisaMovimiento>
        columns={columns}
        data={movimientos}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron movimientos de divisa"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentMovimiento
            ? `Editar movimiento: ${currentMovimiento.DivisaMovimientoId}`
            : "Crear nuevo movimiento de divisa"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentMovimiento ? "Actualizar" : "Crear"}
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
                      htmlFor="CajaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Caja
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
                      {cajas.map((c) => (
                        <option key={c.CajaId} value={c.CajaId}>
                          {c.CajaDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaMovimientoFecha"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Fecha
                    </label>
                    <input
                      type="date"
                      name="DivisaMovimientoFecha"
                      id="DivisaMovimientoFecha"
                      value={formData.DivisaMovimientoFecha}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaMovimientoTipo"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo
                    </label>
                    <select
                      name="DivisaMovimientoTipo"
                      id="DivisaMovimientoTipo"
                      value={formData.DivisaMovimientoTipo}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="C">Compra</option>
                      <option value="V">Venta</option>
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Divisa
                    </label>
                    <select
                      name="DivisaId"
                      id="DivisaId"
                      value={formData.DivisaId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {divisas.map((d) => (
                        <option key={d.DivisaId} value={d.DivisaId}>
                          {d.DivisaNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaMovimientoCambio"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Tipo de Cambio
                    </label>
                    <input
                      type="text"
                      name="DivisaMovimientoCambio"
                      id="DivisaMovimientoCambio"
                      value={
                        formData.DivisaMovimientoCambio
                          ? formatMiles(formData.DivisaMovimientoCambio)
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(/,/g, ".");
                        const num = Number(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            DivisaMovimientoCambio: num,
                          }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaMovimientoCantidad"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cantidad
                    </label>
                    <input
                      type="text"
                      name="DivisaMovimientoCantidad"
                      id="DivisaMovimientoCantidad"
                      value={
                        formData.DivisaMovimientoCantidad
                          ? formatMiles(formData.DivisaMovimientoCantidad)
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(/,/g, ".");
                        const num = Number(raw);
                        if (!isNaN(num)) {
                          setFormData((prev) => ({
                            ...prev,
                            DivisaMovimientoCantidad: num,
                          }));
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="DivisaMovimientoMonto"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Monto (Gs.)
                    </label>
                    <input
                      type="text"
                      name="DivisaMovimientoMonto"
                      id="DivisaMovimientoMonto"
                      value={
                        formData.DivisaMovimientoMonto
                          ? formatMiles(formData.DivisaMovimientoMonto)
                          : ""
                      }
                      readOnly
                      className="bg-gray-100 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Se calcula automáticamente (Cantidad × Cambio)
                    </p>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="UsuarioId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Usuario
                    </label>
                    <select
                      name="UsuarioId"
                      id="UsuarioId"
                      value={formData.UsuarioId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {usuarios.map((u) => (
                        <option key={u.UsuarioId} value={u.UsuarioId}>
                          {u.UsuarioNombre}
                        </option>
                      ))}
                    </select>
                  </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
