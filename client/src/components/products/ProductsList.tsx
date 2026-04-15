import { Plus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import { getLocales } from "../../services/locales.service";
import { formatMiles, formatMilesWithDecimals } from "../../utils/utils";

interface Producto {
  ProductoId?: number;
  ProductoCodigo: string;
  ProductoNombre: string;
  ProductoPrecioVenta: number;
  ProductoPrecioVentaMayorista?: number;
  ProductoPrecioUnitario?: number;
  ProductoPrecioPromedio?: number;
  ProductoStock: number;
  ProductoStockUnitario?: number;
  ProductoCantidadCaja?: number;
  ProductoIVA?: number;
  ProductoStockMinimo?: number;
  ProductoImagen?: string;
  ProductoImagen_GXI?: string;
  LocalId: number;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
}

interface ProductsListProps {
  productos: Producto[];
  onDelete?: (item: Producto) => void;
  onEdit?: (item: Producto) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentProduct?: Producto | null;
  onSubmit: (formData: Producto) => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function ProductsList({
  productos,
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
  currentProduct,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: ProductsListProps) {
  const [formData, setFormData] = useState<Producto>({
    ProductoCodigo: "0",
    ProductoNombre: "",
    ProductoPrecioVenta: 0,
    ProductoPrecioVentaMayorista: 0,
    ProductoPrecioUnitario: 0,
    ProductoPrecioPromedio: 0,
    ProductoStock: 0,
    ProductoStockUnitario: 0,
    ProductoCantidadCaja: 1,
    ProductoIVA: 0,
    ProductoStockMinimo: 0,
    ProductoImagen: "",
    ProductoImagen_GXI: "",
    LocalId: 1,
  });
  const [locales, setLocales] = useState<
    { LocalId: number; LocalNombre: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentProduct) {
      setFormData({
        ...currentProduct,
        ProductoPrecioVenta: currentProduct.ProductoPrecioVenta || 0,
        ProductoPrecioVentaMayorista:
          currentProduct.ProductoPrecioVentaMayorista || 0,
        ProductoPrecioUnitario: currentProduct.ProductoPrecioUnitario || 0,
        ProductoPrecioPromedio:
          typeof currentProduct.ProductoPrecioPromedio === "string"
            ? parseFloat(currentProduct.ProductoPrecioPromedio)
            : currentProduct.ProductoPrecioPromedio || 0,
        ProductoStock: currentProduct.ProductoStock || 0,
        ProductoStockUnitario: currentProduct.ProductoStockUnitario || 0,
        ProductoCantidadCaja: currentProduct.ProductoCantidadCaja || 0,
        ProductoIVA: currentProduct.ProductoIVA || 0,
        ProductoStockMinimo: currentProduct.ProductoStockMinimo || 0,
        ProductoImagen: currentProduct.ProductoImagen || "",
        ProductoImagen_GXI: currentProduct.ProductoImagen_GXI || "",
        LocalId: currentProduct.LocalId,
      });
    } else {
      setFormData({
        ProductoCodigo: "0",
        ProductoNombre: "",
        ProductoPrecioVenta: 0,
        ProductoPrecioVentaMayorista: 0,
        ProductoPrecioUnitario: 0,
        ProductoPrecioPromedio: 0,
        ProductoStock: 0,
        ProductoStockUnitario: 0,
        ProductoCantidadCaja: 1,
        ProductoIVA: 0,
        ProductoStockMinimo: 0,
        ProductoImagen: "",
        ProductoImagen_GXI: "",
        LocalId: 1,
      });
    }
    getLocales(1, 1000).then((res) => {
      setLocales(res.data || []);
    });
  }, [currentProduct]);

  // Manejar cambios en el formulario
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  // Manejar cambios en el nombre del producto (forzar mayúsculas)
  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setFormData((prev) => ({
      ...prev,
      ProductoNombre: value,
    }));
  };

  // Manejar cambio de imagen (file input)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        ProductoImagen: (reader.result as string).split(",")[1] || "",
      }));
    };
    reader.readAsDataURL(file);
  };

  // Eliminar imagen
  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, ProductoImagen: "" }));
  };

  // Enviar formulario
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ProductoImagen_GXI, ...cleanFormData } = formData; // Limpiamos ProductoImagen_GXI antes de enviar
    onSubmit(cleanFormData);
  };

  // Configuración de columnas para la tabla
  const columns = [
    {
      key: "ProductoCodigo",
      label: "Código",
    },
    {
      key: "ProductoNombre",
      label: "Nombre",
    },
    {
      key: "ProductoPrecioVenta",
      label: "Precio Venta",
      render: (item: Producto) =>
        `Gs. ${item.ProductoPrecioVenta?.toLocaleString()}`,
    },
    {
      key: "ProductoStock",
      label: "Stock",
    },
    {
      key: "LocalId",
      label: "Local",
      render: (item: Producto) =>
        String(item.LocalNombre || item.LocalId || "-"),
    },
  ];

  return (
    <>
      {/* Barra superior de búsqueda y acciones */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar productos"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Producto"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>


      {/* Tabla de productos usando el componente DataTable */}
      <DataTable<Producto & { id: number }>
        columns={columns}
        data={productos.map((p) => ({ ...p, id: p.ProductoId ?? 0 }))}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron productos"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />

      {/* Modal para crear/editar */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseModal();
          }}
        >
          {/* Fondo opacado */}
          <div className="absolute inset-0 bg-black opacity-50" />

          <div className="relative w-full max-w-2xl max-h-full z-10">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentProduct
                    ? `Editar producto: ${currentProduct.ProductoNombre}`
                    : "Crear nuevo producto"}
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

              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoCodigo"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Código
                    </label>
                    <input
                      type="text"
                      name="ProductoCodigo"
                      id="ProductoCodigo"
                      value={formData.ProductoCodigo}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoNombre"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="ProductoNombre"
                      id="ProductoNombre"
                      value={formData.ProductoNombre}
                      onChange={handleNombreChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5 uppercase"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoPrecioVenta"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Precio Minorista
                    </label>
                    <input
                      type="text"
                      name="ProductoPrecioVenta"
                      id="ProductoPrecioVenta"
                      value={formatMiles(formData.ProductoPrecioVenta)}
                      onChange={(e) => {
                        // Eliminar puntos y formatear a número
                        const raw = e.target.value.replace(/\./g, "");
                        setFormData((prev) => ({
                          ...prev,
                          ProductoPrecioVenta: Number(raw),
                        }));
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  {/* Campos adicionales opcionales */}
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoPrecioVentaMayorista"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Precio Mayorista
                    </label>
                    <input
                      type="text"
                      name="ProductoPrecioVentaMayorista"
                      id="ProductoPrecioVentaMayorista"
                      value={formatMiles(
                        formData.ProductoPrecioVentaMayorista || 0
                      )}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\./g, "");
                        setFormData((prev) => ({
                          ...prev,
                          ProductoPrecioVentaMayorista: Number(raw),
                        }));
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoPrecioUnitario"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Precio Unitario
                    </label>
                    <input
                      type="number"
                      name="ProductoPrecioUnitario"
                      id="ProductoPrecioUnitario"
                      value={formData.ProductoPrecioUnitario}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoPrecioPromedio"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Precio Costo
                    </label>
                    <input
                      type="text"
                      name="ProductoPrecioPromedio"
                      id="ProductoPrecioPromedio"
                      value={formatMilesWithDecimals(
                        formData.ProductoPrecioPromedio || 0
                      )}
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(",", ".");
                        setFormData((prev) => ({
                          ...prev,
                          ProductoPrecioPromedio: parseFloat(raw) || 0,
                        }));
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoStock"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Stock
                    </label>
                    <input
                      type="number"
                      name="ProductoStock"
                      id="ProductoStock"
                      value={formData.ProductoStock}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoStockUnitario"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Stock Unitario
                    </label>
                    <input
                      type="number"
                      name="ProductoStockUnitario"
                      id="ProductoStockUnitario"
                      value={formData.ProductoStockUnitario}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoCantidadCaja"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cantidad por Caja
                    </label>
                    <input
                      type="number"
                      name="ProductoCantidadCaja"
                      id="ProductoCantidadCaja"
                      value={formData.ProductoCantidadCaja}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoIVA"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      IVA
                    </label>
                    <input
                      type="number"
                      name="ProductoIVA"
                      id="ProductoIVA"
                      value={formData.ProductoIVA}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoStockMinimo"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Stock Mínimo
                    </label>
                    <input
                      type="number"
                      name="ProductoStockMinimo"
                      id="ProductoStockMinimo"
                      value={formData.ProductoStockMinimo}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="LocalId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Local
                    </label>
                    <select
                      name="LocalId"
                      id="LocalId"
                      value={formData.LocalId}
                      onChange={handleInputChange}
                      className="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5"
                      required
                    >
                      <option value="">Seleccione un local</option>
                      {locales.map((local) => (
                        <option key={local.LocalId} value={local.LocalId}>
                          {local.LocalNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Imagen: solo mostrar base64 si existe */}
                  <div className="col-span-6">
                    <label className="block mb-2 text-sm font-medium text-gray-900">
                      Imagen del producto
                    </label>
                    <div className="flex items-center gap-4 mb-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary hover:text-primary-700 border border-primary-300 bg-white rounded px-3 py-1 text-sm font-medium cursor-pointer"
                      >
                        Seleccionar imagen
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        ref={fileInputRef}
                      />
                      {formData.ProductoImagen && (
                        <>
                          <img
                            src={`data:image/jpeg;base64,${formData.ProductoImagen}`}
                            alt="Imagen producto"
                            className="w-32 h-32 object-contain border rounded"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="text-danger-600 hover:text-danger-600 border border-danger-500 bg-white rounded px-3 py-1 text-sm"
                          >
                            Eliminar imagen
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentProduct ? "Actualizar" : "Crear"}
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
