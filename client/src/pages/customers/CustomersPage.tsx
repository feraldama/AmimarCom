import { Users, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getClientes,
  deleteCliente,
  searchClientes,
  createCliente,
  updateCliente,
} from "../../services/clientes.service";
import CustomersList from "../../components/customers/CustomersList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";
import type { Cliente } from "../../types/cliente.types";

interface PaginationData {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function CustomersPage() {
  const [clientesData, setClientesData] = useState<{
    clientes: Cliente[];
    pagination: PaginationData;
  }>({ clientes: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCliente, setCurrentCliente] = useState<Cliente | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("CLIENTES", "crear");
  const puedeEditar = usePermiso("CLIENTES", "editar");
  const puedeEliminar = usePermiso("CLIENTES", "eliminar");
  const puedeLeer = usePermiso("CLIENTES", "leer");

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = appliedSearchTerm
        ? await searchClientes(appliedSearchTerm, currentPage, itemsPerPage, sortKey, sortOrder)
        : await getClientes(currentPage, itemsPerPage, sortKey, sortOrder);
      setClientesData({ clientes: data.data, pagination: data.pagination });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, [currentPage, appliedSearchTerm, itemsPerPage, sortKey, sortOrder]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const applySearch = () => {
    setAppliedSearchTerm(searchTerm);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string | number) => {
    const result = await Swal.fire({
      title: "Estas seguro?",
      text: "No podras revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await deleteCliente(id);
        Swal.fire({ icon: "success", title: "Cliente eliminado", timer: 1500, showConfirmButton: false });
        setClientesData((prev) => ({
          ...prev,
          clientes: prev.clientes.filter((c) => c.ClienteId !== id),
        }));
      } catch (error: unknown) {
        const err = error as { message?: string };
        Swal.fire({ icon: "warning", title: "No permitido", text: err?.message || "No se pudo eliminar" });
      }
    }
  };

  const handleSubmit = async (clienteData: Cliente) => {
    try {
      if (currentCliente) {
        await updateCliente(currentCliente.ClienteId, clienteData);
      } else {
        await createCliente(clienteData);
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: currentCliente ? "Cliente actualizado" : "Cliente creado",
        showConfirmButton: false,
        timer: 1500,
      });
      fetchClientes();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  };

  if (!puedeLeer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver esta seccion</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Gestión de Clientes"
        subtitle={`${clientesData.pagination.totalItems || 0} clientes registrados`}
        icon={Users}
      />

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        <CustomersList
          clientes={clientesData.clientes.map((c) => ({ ...c, id: c.ClienteId }))}
          onDelete={puedeEliminar ? (cliente) => handleDelete(cliente.ClienteId) : undefined}
          onEdit={puedeEditar ? (cliente) => { setCurrentCliente(cliente); setIsModalOpen(true); } : undefined}
          onCreate={puedeCrear ? () => { setCurrentCliente(null); setIsModalOpen(true); } : undefined}
          onSearch={(term) => setSearchTerm(term)}
          searchTerm={searchTerm}
          onKeyPress={(e) => { if (e.key === "Enter") applySearch(); }}
          onSearchSubmit={applySearch}
          isModalOpen={isModalOpen}
          onCloseModal={() => setIsModalOpen(false)}
          currentCliente={currentCliente ? { ...currentCliente, id: currentCliente.ClienteId } : null}
          onSubmit={handleSubmit}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={(key, order) => { setSortKey(key); setSortOrder(order); setCurrentPage(1); }}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={clientesData.pagination.totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
          totalItems={clientesData.pagination.totalItems}
          currentItems={clientesData.clientes.length}
        />
      </div>
    </div>
  );
}
