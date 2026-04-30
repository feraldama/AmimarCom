import { Plus } from "lucide-react";
import React, { useState, useMemo, useRef, useEffect } from "react";

import type { Cliente } from "../../types/cliente.types";
import ClienteFormModal from "./ClienteFormModal";
import Modal from "./Modal";

interface ClienteModalProps {
  show: boolean;
  onClose: () => void;
  clientes: Cliente[];
  onSelect: (cliente: Cliente) => void;
  onCreateCliente?: (cliente: Cliente) => void;
  currentUserId?: string;
}

const ClienteModal: React.FC<ClienteModalProps> = ({
  show,
  onClose,
  clientes,
  onSelect,
  onCreateCliente,
  currentUserId,
}) => {
  const [filtros, setFiltros] = useState({
    ruc: "",
    nombre: "",
    apellido: "",
    telefono: "",
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const rucRef = useRef<HTMLInputElement>(null);

  // Override Radix's default focus (lands on the first tabbable, which would
  // be the close button or "Nuevo Cliente"). Move focus to RUC after open.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => rucRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [show]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(
      (c) =>
        c.ClienteRUC.toLowerCase().includes(filtros.ruc.toLowerCase()) &&
        c.ClienteNombre.toLowerCase().includes(filtros.nombre.toLowerCase()) &&
        (c.ClienteApellido || "")
          .toLowerCase()
          .includes(filtros.apellido.toLowerCase()) &&
        (c.ClienteTelefono || "")
          .toLowerCase()
          .includes(filtros.telefono.toLowerCase())
    );
  }, [clientes, filtros]);

  const totalPages = Math.ceil(clientesFiltrados.length / rowsPerPage);
  const paginatedClientes = clientesFiltrados.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const handleCreateCliente = (cliente: Cliente) => {
    if (onCreateCliente) {
      // Convertir nombre y apellido a mayúsculas como se hacía antes
      const clienteFormateado = {
        ...cliente,
        ClienteNombre: cliente.ClienteNombre.toUpperCase(),
        ClienteApellido: cliente.ClienteApellido.toUpperCase(),
      };
      onCreateCliente(clienteFormateado);
      setShowCreateModal(false);
    }
  };

  return (
    <Modal isOpen={show} onClose={onClose} title="Buscar Cliente" size="4xl">
      <div className="flex justify-end mb-4">
        {onCreateCliente && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            Nuevo Cliente
          </button>
        )}
      </div>
      <div className="bg-gray-50 rounded-lg p-4 mb-4 flex-shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              RUC
            </label>
            <input
              ref={rucRef}
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.ruc}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, ruc: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Nombre
            </label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.nombre}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, nombre: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Apellido
            </label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.apellido}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, apellido: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Teléfono
            </label>
            <input
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
              placeholder="Buscar"
              value={filtros.telefono}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, telefono: e.target.value }))
              }
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto rounded-lg flex-1 min-h-0">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="py-2 px-4 text-left">RUC</th>
              <th className="py-2 px-4 text-left">Nombre</th>
              <th className="py-2 px-4 text-left">Apellido</th>
              <th className="py-2 px-4 text-left">Teléfono</th>
              <th className="py-2 px-4 text-left">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClientes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-400">
                  No hay clientes
                </td>
              </tr>
            )}
            {paginatedClientes.map((c) => (
              <tr
                key={c.ClienteId}
                className="hover:bg-primary-50 cursor-pointer transition"
                onClick={() => onSelect(c)}
              >
                <td className="py-2 px-4">{c.ClienteRUC || ""}</td>
                <td className="py-2 px-4">{c.ClienteNombre}</td>
                <td className="py-2 px-4">{c.ClienteApellido || ""}</td>
                <td className="py-2 px-4">{c.ClienteTelefono || ""}</td>
                <td className="py-2 px-4">
                  {c.ClienteTipo === "MI"
                    ? "Minorista"
                    : c.ClienteTipo === "MA"
                    ? "Mayorista"
                    : c.ClienteTipo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Paginación */}
      <div className="flex items-center justify-between mt-4 flex-shrink-0">
        <div className="text-sm text-gray-500">
          {clientesFiltrados.length === 0
            ? "0"
            : `${(page - 1) * rowsPerPage + 1} to ${Math.min(
                page * rowsPerPage,
                clientesFiltrados.length
              )} of ${clientesFiltrados.length}`}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Filas por página:</span>
          <select
            className="border border-gray-200 rounded px-2 py-1 text-sm"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1 rounded text-gray-500 border border-gray-200 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page === 1}
          >
            Anterior
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded text-gray-500 border border-gray-200 disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page === totalPages || totalPages === 0}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Modal para crear cliente */}
      <ClienteFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCliente}
        showCodJSI={false}
        defaultUserId={currentUserId || ""}
      />
    </Modal>
  );
};

export default ClienteModal;
