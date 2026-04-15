import { List } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getCajaTipos,
  deleteCajaTipo,
  searchCajaTipos,
  createCajaTipo,
  updateCajaTipo,
} from "../../services/cajatipo.service";
import CajaTipoList from "../../components/cajatipo/CajaTipoList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface CajaTipo {
  id: string | number;
  CajaTipoId: string | number;
  CajaTipoDescripcion: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function CajaTipoPage() {
  const [cajaTiposData, setCajaTiposData] = useState<{
    cajaTipos: CajaTipo[];
    pagination: Pagination;
  }>({ cajaTipos: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCajaTipo, setCurrentCajaTipo] = useState<CajaTipo | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("CAJATIPO", "crear");
  const puedeEditar = usePermiso("CAJATIPO", "editar");
  const puedeEliminar = usePermiso("CAJATIPO", "eliminar");
  const puedeLeer = usePermiso("CAJATIPO", "leer");

  const fetchCajaTipos = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchCajaTipos(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getCajaTipos(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setCajaTiposData({
        cajaTipos: data.data,
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
    fetchCajaTipos();
  }, [fetchCajaTipos]);

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
          await deleteCajaTipo(id);
          Swal.fire({
            icon: "success",
            title: "Tipo de caja eliminado exitosamente",
          });
          setCajaTiposData((prev) => ({
            ...prev,
            cajaTipos: prev.cajaTipos.filter(
              (cajaTipo) => cajaTipo.CajaTipoId !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el tipo de caja";
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
    setCurrentCajaTipo(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cajaTipo: CajaTipo) => {
    setCurrentCajaTipo(cajaTipo);
    setIsModalOpen(true);
  };

  const handleSubmit = async (cajaTipoData: CajaTipo) => {
    let mensaje = "";
    try {
      if (currentCajaTipo) {
        await updateCajaTipo(currentCajaTipo.CajaTipoId, cajaTipoData);
        mensaje = "Tipo de caja actualizado exitosamente";
      } else {
        const response = await createCajaTipo(cajaTipoData);
        mensaje = response.message || "Tipo de caja creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchCajaTipos();
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
    return <div>No tienes permiso para ver los tipos de caja</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestión de Tipos de Caja"
        subtitle={`${cajaTiposData.pagination.totalItems || 0} registros`}
        icon={List}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <CajaTipoList
        cajaTipos={cajaTiposData.cajaTipos.map((c) => ({
          ...c,
          id: c.CajaTipoId,
        }))}
        onDelete={
          puedeEliminar
            ? (cajaTipo) => handleDelete(cajaTipo.CajaTipoId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={cajaTiposData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentCajaTipo={
          currentCajaTipo
            ? { ...currentCajaTipo, id: currentCajaTipo.CajaTipoId }
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
        totalPages={cajaTiposData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={cajaTiposData.pagination.totalItems}
        currentItems={cajaTiposData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
