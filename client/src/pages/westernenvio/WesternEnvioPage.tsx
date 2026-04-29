import { Send } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getWesternEnvios,
  deleteWesternEnvio,
  searchWesternEnvios,
  createWesternEnvio,
  updateWesternEnvio,
} from "../../services/westernenvio.service";
import WesternEnvioList, {
  type WesternEnvio,
} from "../../components/westernenvio/WesternEnvioList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";
import { useAuth } from "../../contexts/useAuth";

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function WesternEnvioPage() {
  const { user } = useAuth();
  const [enviosData, setEnviosData] = useState<{
    envios: WesternEnvio[];
    pagination: Pagination;
  }>({ envios: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentEnvio, setCurrentEnvio] = useState<WesternEnvio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("WesternEnvioId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const puedeCrear = usePermiso("WESTERNENVIO", "crear");
  const puedeEditar = usePermiso("WESTERNENVIO", "editar");
  const puedeEliminar = usePermiso("WESTERNENVIO", "eliminar");
  const puedeLeer = usePermiso("WESTERNENVIO", "leer");

  const fetchEnvios = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchWesternEnvios(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getWesternEnvios(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setEnviosData({
        envios: data.data,
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
    fetchEnvios();
  }, [fetchEnvios]);

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

  const handleDelete = async (envio: WesternEnvio) => {
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
          await deleteWesternEnvio(envio.WesternEnvioId);
          Swal.fire({
            icon: "success",
            title: "Envío western eliminado exitosamente",
          });
          fetchEnvios();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el envío western";
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
    setCurrentEnvio(null);
    setIsModalOpen(true);
  };

  const handleEdit = (envio: WesternEnvio) => {
    setCurrentEnvio(envio);
    setIsModalOpen(true);
  };

  const handleSubmit = async (envioData: WesternEnvio) => {
    let mensaje = "";
    try {
      if (currentEnvio) {
        await updateWesternEnvio(currentEnvio.WesternEnvioId, envioData);
        mensaje = "Envío western actualizado exitosamente";
      } else {
        const response = await createWesternEnvio({
          ...envioData,
          WesternEnvioUsuarioId: user?.id,
        });
        mensaje = response.message || "Envío western creado exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchEnvios();
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

  if (!puedeLeer)
    return <div>No tienes permiso para ver los envíos western.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Western Envios"
        subtitle={`${enviosData.pagination.totalItems || 0} registros`}
        icon={Send}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg">
          Error: {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <WesternEnvioList
        envios={enviosData.envios}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentEnvio={currentEnvio}
        onSubmit={handleSubmit}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
          setCurrentPage(1);
        }}
        disableEdit={false}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={enviosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={enviosData.pagination.totalItems}
        currentItems={enviosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
