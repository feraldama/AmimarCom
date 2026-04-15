import { Truck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getTransportes,
  deleteTransporte,
  searchTransportes,
  createTransporte,
  updateTransporte,
} from "../../services/transporte.service";
import TransportesList from "../../components/transporte/TransportesList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Transporte {
  id: string | number;
  TransporteId: string | number;
  TransporteNombre: string;
  TransporteTelefono: string;
  TransporteDireccion: string;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TransporteComision: number;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function TransportesPage() {
  const [transportesData, setTransportesData] = useState<{
    transportes: Transporte[];
    pagination: Pagination;
  }>({ transportes: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTransporte, setCurrentTransporte] = useState<Transporte | null>(
    null
  );
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("TRANSPORTE", "crear");
  const puedeEditar = usePermiso("TRANSPORTE", "editar");
  const puedeEliminar = usePermiso("TRANSPORTE", "eliminar");
  const puedeLeer = usePermiso("TRANSPORTE", "leer");

  const fetchTransportes = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchTransportes(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getTransportes(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setTransportesData({
        transportes: data.data,
        pagination: data.pagination,
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error desconocido");
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, appliedSearchTerm, itemsPerPage, sortKey, sortOrder]);

  useEffect(() => {
    fetchTransportes();
  }, [fetchTransportes]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const applySearch = () => {
    setAppliedSearchTerm(searchTerm);
    setCurrentPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applySearch();
    }
  };

  const handleDelete = async (id: string) => {
    Swal.fire({
      title: "¿Estás seguro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar!",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteTransporte(id);
          Swal.fire({
            icon: "success",
            title: "Transporte eliminado exitosamente",
          });
          setTransportesData((prev) => ({
            ...prev,
            transportes: prev.transportes.filter(
              (transporte) => transporte.TransporteId !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el transporte";
          Swal.fire({
            icon: "warning",
            title: "No permitido",
            text: msg,
          });
        }
      }
    });
  };

  const handleCreate = () => {
    setCurrentTransporte(null);
    setIsModalOpen(true);
  };

  const handleEdit = (transporte: Transporte) => {
    setCurrentTransporte(transporte);
    setIsModalOpen(true);
  };

  const handleSubmit = async (transporteData: Transporte) => {
    let mensaje = "";
    try {
      if (currentTransporte) {
        await updateTransporte(currentTransporte.TransporteId, transporteData);
        mensaje = "Transporte actualizado exitosamente";
      } else {
        const response = await createTransporte(transporteData);
        mensaje = response.message || "Transporte creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchTransportes();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Error desconocido");
      }
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  if (!puedeLeer) return <div>No tienes permiso para ver los transportes</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestion de Transportes"
        subtitle={`${transportesData.pagination.totalItems || 0} registros`}
        icon={Truck}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg">
          Error: {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <TransportesList
        transportes={transportesData.transportes.map((t) => ({
          ...t,
          id: t.TransporteId,
        }))}
        onDelete={
          puedeEliminar
            ? (transporte) => handleDelete(transporte.TransporteId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={transportesData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentTransporte={
          currentTransporte
            ? { ...currentTransporte, id: currentTransporte.TransporteId }
            : null
        }
        onSubmit={handleSubmit}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
          setCurrentPage(1);
        }}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={transportesData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={transportesData.pagination.totalItems}
        currentItems={transportesData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
