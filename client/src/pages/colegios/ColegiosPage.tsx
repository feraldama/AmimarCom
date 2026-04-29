import { GraduationCap } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getColegios,
  deleteColegio,
  searchColegios,
  createColegio,
  updateColegio,
} from "../../services/colegio.service";
import ColegiosList from "../../components/colegios/ColegiosList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Colegio {
  id: string | number;
  ColegioId: string | number;
  ColegioNombre: string;
  ColegioCantCurso: number;
  TipoGastoId: string | number;
  TipoGastoGrupoId: string | number;
  TipoGastoDescripcion?: string;
  TipoGastoGrupoDescripcion?: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function ColegiosPage() {
  const [colegiosData, setColegiosData] = useState<{
    colegios: Colegio[];
    pagination: Pagination;
  }>({ colegios: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentColegio, setCurrentColegio] = useState<Colegio | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("ColegioId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("asc");
  const puedeCrear = usePermiso("COLEGIO", "crear");
  const puedeEditar = usePermiso("COLEGIO", "editar");
  const puedeEliminar = usePermiso("COLEGIO", "eliminar");
  const puedeLeer = usePermiso("COLEGIO", "leer");

  const fetchColegios = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchColegios(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getColegios(currentPage, itemsPerPage, sortKey, sortOrder);
      }
      setColegiosData({
        colegios: data.data,
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
    fetchColegios();
  }, [fetchColegios]);

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

  const handleDelete = async (colegio: Colegio) => {
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
          await deleteColegio(colegio.ColegioId);
          Swal.fire({
            icon: "success",
            title: "Colegio eliminado exitosamente",
          });
          fetchColegios();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el colegio";
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
    setCurrentColegio(null);
    setIsModalOpen(true);
  };

  const handleEdit = (colegio: Colegio) => {
    setCurrentColegio(colegio);
    setIsModalOpen(true);
  };

  const handleSubmit = async (colegioData: Colegio) => {
    let mensaje = "";
    try {
      if (currentColegio) {
        await updateColegio(currentColegio.ColegioId, colegioData);
        mensaje = "Colegio actualizado exitosamente";
      } else {
        const response = await createColegio(colegioData);
        mensaje = response.message || "Colegio creado exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchColegios();
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

  if (!puedeLeer) return <div>No tienes permiso para ver los colegios.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Administración de Colegios"
        subtitle={`${colegiosData.pagination.totalItems || 0} registros`}
        icon={GraduationCap}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <ColegiosList
        colegios={colegiosData.colegios.map((c) => ({ ...c, id: c.ColegioId }))}
        onDelete={
          puedeEliminar ? (colegio) => handleDelete(colegio) : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentColegio={
          currentColegio
            ? { ...currentColegio, id: currentColegio.ColegioId }
            : null
        }
        onSubmit={handleSubmit}
        onCurrentColegioChange={(colegio) => {
          setCurrentColegio(colegio);
        }}
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
        totalPages={colegiosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={colegiosData.pagination.totalItems}
        currentItems={colegiosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
