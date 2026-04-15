import { Plus } from "lucide-react";
import React, { useState } from "react";

import Modal from "./Modal";

// Definir la interfaz Proveedor localmente
interface Proveedor {
  ProveedorId: number;
  ProveedorRUC: string;
  ProveedorNombre: string;
  ProveedorDireccion?: string;
  ProveedorTelefono?: string;
}

interface CreateProveedorData {
  ProveedorRUC: string;
  ProveedorNombre: string;
  ProveedorDireccion?: string;
  ProveedorTelefono?: string;
}

interface ProveedorModalProps {
  show: boolean;
  onClose: () => void;
  proveedores: Proveedor[];
  onSelect: (proveedor: Proveedor) => void;
  onCreateProveedor: (proveedorData: CreateProveedorData) => Promise<void>;
}

const ProveedorModal: React.FC<ProveedorModalProps> = ({
  show,
  onClose,
  proveedores,
  onSelect,
  onCreateProveedor,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProveedor, setNewProveedor] = useState<CreateProveedorData>({
    ProveedorRUC: "",
    ProveedorNombre: "",
    ProveedorDireccion: "",
    ProveedorTelefono: "",
  });

  const filteredProveedores = proveedores.filter(
    (p) =>
      p.ProveedorNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ProveedorRUC.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProveedor.ProveedorNombre.trim()) {
      return;
    }

    try {
      await onCreateProveedor(newProveedor);
      setNewProveedor({
        ProveedorRUC: "",
        ProveedorNombre: "",
        ProveedorDireccion: "",
        ProveedorTelefono: "",
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error al crear proveedor:", error);
    }
  };

  return (
    <Modal isOpen={show} onClose={onClose} title="Seleccionar Proveedor" size="4xl">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
          Crear Nuevo Proveedor
        </button>
      </div>

      {!showCreateForm ? (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredProveedores.map((proveedor) => (
              <div
                key={proveedor.ProveedorId}
                className="p-3 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(proveedor)}
              >
                <div className="font-semibold">
                  {proveedor.ProveedorNombre}
                </div>
                <div className="text-sm text-gray-600">
                  RUC: {proveedor.ProveedorRUC || "Sin RUC"}
                </div>
                {proveedor.ProveedorTelefono && (
                  <div className="text-sm text-gray-600">
                    Tel: {proveedor.ProveedorTelefono}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={handleCreateProveedor} className="space-y-4">
          <h3 className="text-lg font-semibold">Crear Nuevo Proveedor</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={newProveedor.ProveedorNombre}
              onChange={(e) =>
                setNewProveedor({
                  ...newProveedor,
                  ProveedorNombre: e.target.value,
                })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUC
            </label>
            <input
              type="text"
              value={newProveedor.ProveedorRUC}
              onChange={(e) =>
                setNewProveedor({
                  ...newProveedor,
                  ProveedorRUC: e.target.value,
                })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              value={newProveedor.ProveedorDireccion}
              onChange={(e) =>
                setNewProveedor({
                  ...newProveedor,
                  ProveedorDireccion: e.target.value,
                })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              type="text"
              value={newProveedor.ProveedorTelefono}
              onChange={(e) =>
                setNewProveedor({
                  ...newProveedor,
                  ProveedorTelefono: e.target.value,
                })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-success-500 text-white px-4 py-2 rounded-lg hover:bg-success-600"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ProveedorModal;
