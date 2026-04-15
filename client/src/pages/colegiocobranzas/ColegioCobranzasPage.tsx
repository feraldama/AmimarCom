import { CreditCard } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getColegioCobranzas,
  deleteColegioCobranza,
  searchColegioCobranzas,
  createColegioCobranza,
  updateColegioCobranza,
} from "../../services/colegiocobranza.service";
import ColegioCobranzasList from "../../components/colegiocobranzas/ColegioCobranzasList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface ColegioCobranza {
  id: string | number;
  ColegioCobranzaId: string | number;
  CajaId: string | number;
  ColegioCobranzaFecha: string;
  NominaId: string | number;
  ColegioCobranzaMesPagado: string;
  ColegioCobranzaMes: string;
  ColegioCobranzaDiasMora: number;
  ColegioCobranzaExamen: string;
  UsuarioId: string | number;
  ColegioCobranzaDescuento: number;
  CajaDescripcion?: string;
  NominaNombre?: string;
  NominaApellido?: string;
  UsuarioNombre?: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function ColegioCobranzasPage() {
  const [cobranzasData, setCobranzasData] = useState<{
    cobranzas: ColegioCobranza[];
    pagination: Pagination;
  }>({ cobranzas: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentCobranza, setCurrentCobranza] =
    useState<ColegioCobranza | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("ColegioCobranzaId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const puedeCrear = usePermiso("COLEGIOCOBRANZA", "crear");
  const puedeEditar = usePermiso("COLEGIOCOBRANZA", "editar");
  const puedeEliminar = usePermiso("COLEGIOCOBRANZA", "eliminar");
  const puedeLeer = usePermiso("COLEGIOCOBRANZA", "leer");

  const fetchCobranzas = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchColegioCobranzas(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getColegioCobranzas(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setCobranzasData({
        cobranzas: data.data,
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
    fetchCobranzas();
  }, [fetchCobranzas]);

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

  const handleDelete = async (cobranza: ColegioCobranza) => {
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
          await deleteColegioCobranza(cobranza.ColegioCobranzaId);
          Swal.fire({
            icon: "success",
            title: "Cobranza eliminada exitosamente",
          });
          fetchCobranzas();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar la cobranza";
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
    setCurrentCobranza(null);
    setIsModalOpen(true);
  };

  const handleEdit = (cobranza: ColegioCobranza) => {
    setCurrentCobranza(cobranza);
    setIsModalOpen(true);
  };

  const handleSubmit = async (cobranzaData: ColegioCobranza) => {
    let mensaje = "";
    try {
      if (currentCobranza) {
        await updateColegioCobranza(
          currentCobranza.ColegioCobranzaId,
          cobranzaData
        );
        mensaje = "Cobranza actualizada exitosamente";
      } else {
        const response = await createColegioCobranza(cobranzaData);
        mensaje = response.message || "Cobranza creada exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchCobranzas();
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

  if (!puedeLeer) return <div>No tienes permiso para ver las cobranzas.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Administración de Cobranzas"
        subtitle={`${cobranzasData.pagination.totalItems || 0} registros`}
        icon={CreditCard}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <ColegioCobranzasList
        cobranzas={cobranzasData.cobranzas.map((c) => ({
          ...c,
          id: c.ColegioCobranzaId,
        }))}
        onDelete={
          puedeEliminar ? (cobranza) => handleDelete(cobranza) : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={cobranzasData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentCobranza={
          currentCobranza
            ? { ...currentCobranza, id: currentCobranza.ColegioCobranzaId }
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
        totalPages={cobranzasData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={cobranzasData.pagination.totalItems}
        currentItems={cobranzasData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
