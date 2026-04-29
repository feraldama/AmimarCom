import { ArrowLeftRight } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getDivisaMovimientos,
  deleteDivisaMovimiento,
  searchDivisaMovimientos,
  createDivisaMovimiento,
  updateDivisaMovimiento,
} from "../../services/divisamovimiento.service";
import {
  findRegistroDiarioCajaByDivisaMovimientoId,
  deleteRegistroDiarioCaja,
} from "../../services/registros.service";
import DivisasMovimientosList from "../../components/divisamovimiento/DivisasMovimientosList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface DivisaMovimiento {
  id: string | number;
  DivisaMovimientoId: string | number;
  CajaId: number;
  DivisaMovimientoFecha: string;
  DivisaMovimientoTipo: string;
  DivisaId: number;
  DivisaMovimientoCambio: number;
  DivisaMovimientoCantidad: number;
  DivisaMovimientoMonto: number;
  UsuarioId: number;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function DivisasMovimientosPage() {
  const [movimientosData, setMovimientosData] = useState<{
    movimientos: DivisaMovimiento[];
    pagination: Pagination;
  }>({ movimientos: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMovimiento, setCurrentMovimiento] =
    useState<DivisaMovimiento | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>(
    "DivisaMovimientoId"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const puedeCrear = usePermiso("DIVISAMOVIMIENTO", "crear");
  const puedeEditar = usePermiso("DIVISAMOVIMIENTO", "editar");
  const puedeEliminar = usePermiso("DIVISAMOVIMIENTO", "eliminar");
  const puedeLeer = usePermiso("DIVISAMOVIMIENTO", "leer");

  const fetchMovimientos = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchDivisaMovimientos(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getDivisaMovimientos(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setMovimientosData({
        movimientos: data.data,
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
    fetchMovimientos();
  }, [fetchMovimientos]);

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
          // Buscar y eliminar el registro diario de caja asociado
          try {
            const registroDiarioCaja =
              await findRegistroDiarioCajaByDivisaMovimientoId(id);
            if (registroDiarioCaja && registroDiarioCaja.RegistroDiarioCajaId) {
              await deleteRegistroDiarioCaja(
                registroDiarioCaja.RegistroDiarioCajaId
              );
            }
          } catch (error) {
            // Si no se encuentra el registro diario de caja, continuar con la eliminación del movimiento
            console.warn(
              "No se encontró registro diario de caja asociado:",
              error
            );
          }

          // Eliminar el movimiento de divisa
          await deleteDivisaMovimiento(id);
          Swal.fire({
            icon: "success",
            title: "Movimiento eliminado exitosamente",
          });
          setMovimientosData((prev) => ({
            ...prev,
            movimientos: prev.movimientos.filter(
              (movimiento) => movimiento.DivisaMovimientoId !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el movimiento";
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
    setCurrentMovimiento(null);
    setIsModalOpen(true);
  };

  const handleEdit = (movimiento: DivisaMovimiento) => {
    setCurrentMovimiento(movimiento);
    setIsModalOpen(true);
  };

  const handleSubmit = async (movimientoData: DivisaMovimiento) => {
    let mensaje = "";
    try {
      if (currentMovimiento) {
        await updateDivisaMovimiento(
          currentMovimiento.DivisaMovimientoId,
          movimientoData
        );
        mensaje = "Movimiento actualizado exitosamente";
      } else {
        const response = await createDivisaMovimiento(movimientoData);
        mensaje = response.message || "Movimiento creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchMovimientos();
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
    return <div>No tienes permiso para ver los movimientos de divisa</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Movimientos de Divisa"
        subtitle={`${movimientosData.pagination.totalItems || 0} registros`}
        icon={ArrowLeftRight}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <DivisasMovimientosList
        movimientos={movimientosData.movimientos.map((m) => ({
          ...m,
          id: m.DivisaMovimientoId,
        }))}
        onDelete={
          puedeEliminar
            ? (movimiento) =>
                handleDelete(movimiento.DivisaMovimientoId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentMovimiento={
          currentMovimiento
            ? { ...currentMovimiento, id: currentMovimiento.DivisaMovimientoId }
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
        totalPages={movimientosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={movimientosData.pagination.totalItems}
        currentItems={movimientosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
