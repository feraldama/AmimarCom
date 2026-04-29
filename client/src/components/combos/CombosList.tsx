import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import Modal from "../common/Modal";

interface Combo {
  id: string | number;
  ComboId: string | number;
  ComboDescripcion: string;
  ProductoId: string | number;
  ComboCantidad: number;
  ComboPrecio: number;
  [key: string]: unknown;
}

interface Producto {
  ProductoId: string | number;
  ProductoNombre: string;
}

interface CombosListProps {
  combos: Combo[];
  productos: Producto[];
  onDelete?: (item: Combo) => void;
  onEdit?: (item: Combo) => void;
  onCreate?: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCombo?: Combo | null;
  onSubmit: (formData: Combo) => void;
  onSearch: (value: string) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
}

export default function CombosList({
  combos,
  productos,
  onDelete,
  onEdit,
  onCreate,
  isModalOpen,
  onCloseModal,
  currentCombo,
  onSubmit,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
}: CombosListProps) {
  const [formData, setFormData] = useState<Combo>({
    id: "",
    ComboId: "",
    ComboDescripcion: "",
    ProductoId: "",
    ComboCantidad: 1,
    ComboPrecio: 0,
  });

  useEffect(() => {
    if (currentCombo && productos.length > 0) {
      let productoId = currentCombo.ProductoId;

      // Si ProductoId no es un número, buscar por nombre
      if (isNaN(Number(productoId))) {
        const productoEncontrado = productos.find(
          (p) => p.ProductoNombre === productoId
        );
        productoId = productoEncontrado
          ? String(productoEncontrado.ProductoId)
          : "";
      } else {
        productoId = String(productoId);
      }

      setFormData({
        ...currentCombo,
        ProductoId: productoId,
      });
    } else if (!currentCombo) {
      setFormData({
        id: "",
        ComboId: "",
        ComboDescripcion: "",
        ProductoId: "",
        ComboCantidad: 1,
        ComboPrecio: 0,
      });
    }
  }, [currentCombo, productos]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "ComboCantidad" || name === "ComboPrecio"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const formId = "combo-form";

  const columns = [
    { key: "ComboId", label: "ID" },
    { key: "ComboDescripcion", label: "Descripción" },
    { key: "ProductoId", label: "Producto" },
    { key: "ComboCantidad", label: "Cantidad" },
    { key: "ComboPrecio", label: "Precio" },
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
            placeholder="Buscar combos"
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nuevo Combo"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<Combo>
        columns={columns}
        data={combos.map((combo) => ({
          ...combo,
          ProductoId:
            productos.find((p) => p.ProductoId === combo.ProductoId)
              ?.ProductoNombre || combo.ProductoId,
        }))}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron combos"
      />
      <Modal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={
          currentCombo
            ? `Editar combo: ${currentCombo.ComboDescripcion}`
            : "Crear nuevo combo"
        }
        size="2xl"
        footer={
          <>
            <ActionButton
              label={currentCombo ? "Actualizar" : "Crear"}
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
                      htmlFor="ComboDescripcion"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Descripción
                    </label>
                    <input
                      type="text"
                      name="ComboDescripcion"
                      id="ComboDescripcion"
                      value={formData.ComboDescripcion}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ProductoId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Producto
                    </label>
                    <select
                      name="ProductoId"
                      id="ProductoId"
                      value={formData.ProductoId}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    >
                      <option value="">Seleccione un producto</option>
                      {productos.map((producto) => (
                        <option
                          key={String(producto.ProductoId)}
                          value={String(producto.ProductoId)}
                        >
                          {producto.ProductoNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ComboCantidad"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Cantidad
                    </label>
                    <input
                      type="number"
                      name="ComboCantidad"
                      id="ComboCantidad"
                      value={formData.ComboCantidad}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                      min={1}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ComboPrecio"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Precio
                    </label>
                    <input
                      type="number"
                      name="ComboPrecio"
                      id="ComboPrecio"
                      value={formData.ComboPrecio}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                      min={0}
                      step={0.01}
                    />
                  </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
