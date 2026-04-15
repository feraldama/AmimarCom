import { FileStack } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getNominas,
  deleteNomina,
  searchNominas,
  createNomina,
  updateNomina,
} from "../../services/nomina.service";
import NominasList from "../../components/nominas/NominasList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Nomina {
  id: string | number;
  NominaId: string | number;
  NominaNombre: string;
  NominaApellido: string;
  ColegioId: string | number;
  ColegioCursoId: string | number;
  ColegioNombre?: string;
  ColegioCursoNombre?: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function NominasPage() {
  const [nominasData, setNominasData] = useState<{
    nominas: Nomina[];
    pagination: Pagination;
  }>({ nominas: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentNomina, setCurrentNomina] = useState<Nomina | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("NominaId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("asc");
  const puedeCrear = usePermiso("NOMINA", "crear");
  const puedeEditar = usePermiso("NOMINA", "editar");
  const puedeEliminar = usePermiso("NOMINA", "eliminar");
  const puedeLeer = usePermiso("NOMINA", "leer");

  const fetchNominas = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchNominas(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getNominas(currentPage, itemsPerPage, sortKey, sortOrder);
      }
      setNominasData({
        nominas: data.data,
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
    fetchNominas();
  }, [fetchNominas]);

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

  const handleDelete = async (nomina: Nomina) => {
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
          await deleteNomina(nomina.NominaId);
          Swal.fire({
            icon: "success",
            title: "Nomina eliminada exitosamente",
          });
          fetchNominas();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar la nomina";
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
    setCurrentNomina(null);
    setIsModalOpen(true);
  };

  const handleEdit = (nomina: Nomina) => {
    setCurrentNomina(nomina);
    setIsModalOpen(true);
  };

  const handleSubmit = async (nominaData: Nomina) => {
    let mensaje = "";
    try {
      if (currentNomina) {
        await updateNomina(currentNomina.NominaId, nominaData);
        mensaje = "Nomina actualizada exitosamente";
      } else {
        const response = await createNomina(nominaData);
        mensaje = response.message || "Nomina creada exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchNominas();
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

  if (!puedeLeer) return <div>No tienes permiso para ver las nominas.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Administración de Nóminas"
        subtitle={`${nominasData.pagination.totalItems || 0} registros`}
        icon={FileStack}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <NominasList
        nominas={nominasData.nominas.map((n) => ({ ...n, id: n.NominaId }))}
        onDelete={puedeEliminar ? (nomina) => handleDelete(nomina) : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={nominasData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentNomina={
          currentNomina
            ? { ...currentNomina, id: currentNomina.NominaId }
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
        totalPages={nominasData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={nominasData.pagination.totalItems}
        currentItems={nominasData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
