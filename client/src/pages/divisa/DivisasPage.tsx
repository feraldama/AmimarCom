import { DollarSign } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getDivisas,
  deleteDivisa,
  searchDivisas,
  createDivisa,
  updateDivisa,
} from "../../services/divisa.service";
import DivisasList from "../../components/divisa/DivisasList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Divisa {
  id: string | number;
  DivisaId: string | number;
  DivisaNombre: string;
  DivisaCompraMonto: number;
  DivisaVentaMonto: number;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function DivisasPage() {
  const [divisasData, setDivisasData] = useState<{
    divisas: Divisa[];
    pagination: Pagination;
  }>({ divisas: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDivisa, setCurrentDivisa] = useState<Divisa | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("DIVISA", "crear");
  const puedeEditar = usePermiso("DIVISA", "editar");
  const puedeEliminar = usePermiso("DIVISA", "eliminar");
  const puedeLeer = usePermiso("DIVISA", "leer");

  const fetchDivisas = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchDivisas(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getDivisas(currentPage, itemsPerPage, sortKey, sortOrder);
      }
      setDivisasData({
        divisas: data.data,
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
    fetchDivisas();
  }, [fetchDivisas]);

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
          await deleteDivisa(id);
          Swal.fire({
            icon: "success",
            title: "Divisa eliminada exitosamente",
          });
          setDivisasData((prev) => ({
            ...prev,
            divisas: prev.divisas.filter((divisa) => divisa.DivisaId !== id),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar la divisa";
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
    setCurrentDivisa(null);
    setIsModalOpen(true);
  };

  const handleEdit = (divisa: Divisa) => {
    setCurrentDivisa(divisa);
    setIsModalOpen(true);
  };

  const handleSubmit = async (divisaData: Divisa) => {
    let mensaje = "";
    try {
      if (currentDivisa) {
        await updateDivisa(currentDivisa.DivisaId, divisaData);
        mensaje = "Divisa actualizada exitosamente";
      } else {
        const response = await createDivisa(divisaData);
        mensaje = response.message || "Divisa creada exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchDivisas();
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

  if (!puedeLeer) return <div>No tienes permiso para ver las divisas</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestion de Divisas"
        subtitle={`${divisasData.pagination.totalItems || 0} registros`}
        icon={DollarSign}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <DivisasList
        divisas={divisasData.divisas.map((d) => ({
          ...d,
          id: d.DivisaId,
        }))}
        onDelete={
          puedeEliminar
            ? (divisa) => handleDelete(divisa.DivisaId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={divisasData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentDivisa={
          currentDivisa
            ? { ...currentDivisa, id: currentDivisa.DivisaId }
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
        totalPages={divisasData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={divisasData.pagination.totalItems}
        currentItems={divisasData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
