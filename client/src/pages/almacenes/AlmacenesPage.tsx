import { Store } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getAlmacenes,
  deleteAlmacen,
  searchAlmacenes,
  createAlmacen,
  updateAlmacen,
} from "../../services/almacenes.service";
import AlmacenesList from "../../components/almacenes/AlmacenesList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Almacen {
  id: string | number;
  AlmacenId: string | number;
  AlmacenNombre: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function AlmacenesPage() {
  const [almacenesData, setAlmacenesData] = useState<{
    almacenes: Almacen[];
    pagination: Pagination;
  }>({ almacenes: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAlmacen, setCurrentAlmacen] = useState<Almacen | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("ALMACENES", "crear");
  const puedeEditar = usePermiso("ALMACENES", "editar");
  const puedeEliminar = usePermiso("ALMACENES", "eliminar");
  const puedeLeer = usePermiso("ALMACENES", "leer");

  const fetchAlmacenes = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchAlmacenes(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getAlmacenes(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setAlmacenesData({
        almacenes: data.data,
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
    fetchAlmacenes();
  }, [fetchAlmacenes]);

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
          await deleteAlmacen(id);
          Swal.fire({
            icon: "success",
            title: "Almacén eliminado exitosamente",
          });
          setAlmacenesData((prev) => ({
            ...prev,
            almacenes: prev.almacenes.filter(
              (almacen) => almacen.AlmacenId !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el almacén";
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
    setCurrentAlmacen(null);
    setIsModalOpen(true);
  };

  const handleEdit = (almacen: Almacen) => {
    setCurrentAlmacen(almacen);
    setIsModalOpen(true);
  };

  const handleSubmit = async (almacenData: Almacen) => {
    let mensaje = "";
    try {
      if (currentAlmacen) {
        await updateAlmacen(currentAlmacen.AlmacenId, almacenData);
        mensaje = "Almacén actualizado exitosamente";
      } else {
        const response = await createAlmacen(almacenData);
        mensaje = response.message || "Almacén creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchAlmacenes();
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

  if (!puedeLeer) return <div>No tienes permiso para ver los almacenes</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestión de Almacenes"
        subtitle={`${almacenesData.pagination.totalItems || 0} registros`}
        icon={Store}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <AlmacenesList
        almacenes={almacenesData.almacenes.map((a) => ({
          ...a,
          id: a.AlmacenId,
        }))}
        onDelete={
          puedeEliminar
            ? (almacen) => handleDelete(almacen.AlmacenId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentAlmacen={
          currentAlmacen
            ? { ...currentAlmacen, id: currentAlmacen.AlmacenId }
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
        totalPages={almacenesData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={almacenesData.pagination.totalItems}
        currentItems={almacenesData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
