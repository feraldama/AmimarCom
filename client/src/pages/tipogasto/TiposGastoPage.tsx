import { List, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { usePermiso } from "../../hooks/usePermiso";
import {
  getTiposGastoPaginated,
  deleteTipoGasto,
  searchTiposGasto,
  createTipoGasto,
  updateTipoGasto,
} from "../../services/tipogasto.service";
import TiposGastoList from "../../components/tipogasto/TiposGastoList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";

interface TipoGasto {
  id: string | number;
  TipoGastoId: string | number;
  TipoGastoDescripcion: string;
  TipoGastoCantGastos: number;
  [key: string]: unknown;
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function TiposGastoPage() {
  const [tiposGastoData, setTiposGastoData] = useState<{
    tiposGasto: TipoGasto[];
    pagination: PaginationData;
  }>({ tiposGasto: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTipoGasto, setCurrentTipoGasto] = useState<TipoGasto | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const puedeCrear = usePermiso("TIPOSGASTO", "crear");
  const puedeEditar = usePermiso("TIPOSGASTO", "editar");
  const puedeEliminar = usePermiso("TIPOSGASTO", "eliminar");
  const puedeLeer = usePermiso("TIPOSGASTO", "leer");

  const fetchTiposGasto = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = appliedSearchTerm
        ? await searchTiposGasto(appliedSearchTerm, currentPage, itemsPerPage, sortKey, sortOrder)
        : await getTiposGastoPaginated(currentPage, itemsPerPage, sortKey, sortOrder);
      setTiposGastoData({ tiposGasto: data.data, pagination: data.pagination });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tipos de gasto");
    } finally {
      setLoading(false);
    }
  }, [currentPage, appliedSearchTerm, itemsPerPage, sortKey, sortOrder]);

  useEffect(() => {
    fetchTiposGasto();
  }, [fetchTiposGasto]);

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

  const handleDelete = async (id: string) => {
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
        await deleteTipoGasto(id);
        Swal.fire({ icon: "success", title: "Tipo de gasto eliminado", timer: 1500, showConfirmButton: false });
        setTiposGastoData((prev) => ({
          ...prev,
          tiposGasto: prev.tiposGasto.filter((t) => t.TipoGastoId !== id),
        }));
      } catch (error: unknown) {
        const err = error as { message?: string };
        Swal.fire({ icon: "warning", title: "No permitido", text: err?.message || "No se pudo eliminar" });
      }
    }
  };

  const handleSubmit = async (tipoGastoData: TipoGasto) => {
    try {
      if (currentTipoGasto) {
        await updateTipoGasto(currentTipoGasto.TipoGastoId, tipoGastoData);
      } else {
        await createTipoGasto(tipoGastoData);
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: currentTipoGasto ? "Tipo de gasto actualizado" : "Tipo de gasto creado",
        showConfirmButton: false,
        timer: 1500,
      });
      fetchTiposGasto();
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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="size-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver esta seccion</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Gestion de Tipos de Gasto"
        subtitle={`${tiposGastoData.pagination.totalItems || 0} registros`}
        icon={List}
      />

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        <TiposGastoList
          tiposGasto={tiposGastoData.tiposGasto.map((t) => ({ ...t, id: t.TipoGastoId }))}
          onDelete={puedeEliminar ? (tipo) => handleDelete(tipo.TipoGastoId as string) : undefined}
          onEdit={puedeEditar ? (tipo) => { setCurrentTipoGasto(tipo); setIsModalOpen(true); } : undefined}
          onCreate={puedeCrear ? () => { setCurrentTipoGasto(null); setIsModalOpen(true); } : undefined}
          pagination={tiposGastoData.pagination}
          onSearch={(term) => setSearchTerm(term)}
          searchTerm={searchTerm}
          onKeyPress={(e) => { if (e.key === "Enter") applySearch(); }}
          onSearchSubmit={applySearch}
          isModalOpen={isModalOpen}
          onCloseModal={() => setIsModalOpen(false)}
          currentTipoGasto={currentTipoGasto ? { ...currentTipoGasto, id: currentTipoGasto.TipoGastoId } : null}
          onSubmit={handleSubmit}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={(key, order) => { setSortKey(key); setSortOrder(order); setCurrentPage(1); }}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={tiposGastoData.pagination.totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
          totalItems={tiposGastoData.pagination.totalItems}
          currentItems={tiposGastoData.pagination.itemsPerPage}
        />
      </div>
    </div>
  );
}
