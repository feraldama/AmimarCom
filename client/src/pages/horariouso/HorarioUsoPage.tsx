import { Clock } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getHorariosUso,
  deleteHorarioUso,
  searchHorariosUso,
  createHorarioUso,
  updateHorarioUso,
} from "../../services/horariouso.service";
import HorarioUsoList from "../../components/horariouso/HorarioUsoList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface HorarioUso {
  id: string | number;
  HorarioUsoId: string | number;
  HorarioUsoDesde: string;
  HorarioUsoHasta: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function HorarioUsoPage() {
  const [horariosData, setHorariosData] = useState<{
    horarios: HorarioUso[];
    pagination: Pagination;
  }>({ horarios: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentHorario, setCurrentHorario] = useState<HorarioUso | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("HORARIOUSO", "crear");
  const puedeEditar = usePermiso("HORARIOUSO", "editar");
  const puedeEliminar = usePermiso("HORARIOUSO", "eliminar");
  const puedeLeer = usePermiso("HORARIOUSO", "leer");

  const fetchHorarios = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchHorariosUso(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getHorariosUso(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setHorariosData({
        horarios: data.data,
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
    fetchHorarios();
  }, [fetchHorarios]);

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
          await deleteHorarioUso(id);
          Swal.fire({
            icon: "success",
            title: "Horario eliminado exitosamente",
          });
          setHorariosData((prev) => ({
            ...prev,
            horarios: prev.horarios.filter(
              (horario) => horario.HorarioUsoId !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el horario";
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
    setCurrentHorario(null);
    setIsModalOpen(true);
  };

  const handleEdit = (horario: HorarioUso) => {
    setCurrentHorario(horario);
    setIsModalOpen(true);
  };

  const handleSubmit = async (horarioData: HorarioUso) => {
    let mensaje = "";
    try {
      if (currentHorario) {
        await updateHorarioUso(currentHorario.HorarioUsoId, horarioData);
        mensaje = "Horario actualizado exitosamente";
      } else {
        const response = await createHorarioUso(horarioData);
        mensaje = response.message || "Horario creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchHorarios();
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

  if (!puedeLeer) return <div>No tienes permiso para ver los horarios</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestión de Horarios de Uso"
        subtitle={`${horariosData.pagination.totalItems || 0} registros`}
        icon={Clock}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <HorarioUsoList
        horarios={horariosData.horarios.map((h) => ({
          ...h,
          id: h.HorarioUsoId,
        }))}
        onDelete={
          puedeEliminar
            ? (horario) => handleDelete(horario.HorarioUsoId as string)
            : undefined
        }
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={horariosData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentHorario={
          currentHorario ? { ...currentHorario, id: currentHorario.HorarioUsoId } : null
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
        totalPages={horariosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={horariosData.pagination.totalItems}
        currentItems={horariosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
