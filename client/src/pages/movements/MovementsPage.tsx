import { CalendarDays } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getRegistrosDiariosCaja,
  deleteRegistroDiarioCaja,
  searchRegistrosDiariosCaja,
  createRegistroDiarioCaja,
  updateRegistroDiarioCaja,
} from "../../services/registros.service";
import MovementsList, {
  type Movimiento,
} from "../../components/movements/MovementsList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import FilterPanel, { FilterSelect } from "../../components/common/FilterPanel";
import { getCajas } from "../../services/cajas.service";
import { getTiposGasto } from "../../services/tipogasto.service";
import { getAllTipoGastoGrupo } from "../../services/tipogastogrupo.service";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface CajaOption {
  CajaId: number;
  CajaDescripcion: string;
}
interface TipoGastoOption {
  TipoGastoId: number;
  TipoGastoDescripcion: string;
}
interface TipoGastoGrupoOption {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TipoGastoGrupoDescripcion: string;
}

interface Filtros {
  fechaDesde: string;
  fechaHasta: string;
  cajaId: string;
  tipoGastoId: string;
  tipoGastoGrupoId: string;
}

const FILTROS_VACIOS: Filtros = {
  fechaDesde: "",
  fechaHasta: "",
  cajaId: "",
  tipoGastoId: "",
  tipoGastoGrupoId: "",
};

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function MovementsPage() {
  const [movimientosData, setMovimientosData] = useState<{
    movimientos: Movimiento[];
    pagination: Pagination;
  }>({ movimientos: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentMovement, setCurrentMovement] = useState<Movimiento | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("RegistroDiarioCajaId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [appliedFiltros, setAppliedFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const [tiposGasto, setTiposGasto] = useState<TipoGastoOption[]>([]);
  const [tiposGastoGrupo, setTiposGastoGrupo] = useState<TipoGastoGrupoOption[]>(
    []
  );
  const puedeCrear = usePermiso("REGISTRODIARIOCAJA", "crear");
  const puedeEditar = usePermiso("REGISTRODIARIOCAJA", "editar");
  const puedeEliminar = usePermiso("REGISTRODIARIOCAJA", "eliminar");
  const puedeLeer = usePermiso("REGISTRODIARIOCAJA", "leer");

  const fetchMovimientos = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchRegistrosDiariosCaja(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder,
          appliedFiltros
        );
      } else {
        data = await getRegistrosDiariosCaja(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder,
          appliedFiltros
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
  }, [
    currentPage,
    appliedSearchTerm,
    itemsPerPage,
    sortKey,
    sortOrder,
    appliedFiltros,
  ]);

  useEffect(() => {
    fetchMovimientos();
  }, [fetchMovimientos]);

  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const [cajasResp, tiposResp, gruposResp] = await Promise.all([
          getCajas(1, 1000),
          getTiposGasto(),
          getAllTipoGastoGrupo(),
        ]);
        setCajas(cajasResp.data || []);
        setTiposGasto(tiposResp || []);
        setTiposGastoGrupo(gruposResp || []);
      } catch {
        // Si fallan las opciones, los filtros simplemente quedan vacíos
      }
    };
    cargarOpciones();
  }, []);

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

  const handleApplyFilter = () => {
    setAppliedFiltros(filtros);
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    setFiltros(FILTROS_VACIOS);
    setAppliedFiltros(FILTROS_VACIOS);
    setCurrentPage(1);
  };

  // Grupos de gasto filtrados por el tipo de gasto seleccionado en el filtro
  const gruposFiltrados = filtros.tipoGastoId
    ? tiposGastoGrupo.filter(
        (g) => String(g.TipoGastoId) === String(filtros.tipoGastoId)
      )
    : tiposGastoGrupo;

  const handleDelete = async (movimiento: Movimiento) => {
    Swal.fire({
      title: "¿Estás seguro?",
      text: "¡No podrás revertir esto!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d9488",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar!",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteRegistroDiarioCaja(movimiento.RegistroDiarioCajaId);
          Swal.fire({
            icon: "success",
            title: "Registro eliminado exitosamente",
          });
          fetchMovimientos();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el registro";
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
    setCurrentMovement(null);
    setIsModalOpen(true);
  };

  const handleEdit = (movimiento: Movimiento) => {
    setCurrentMovement(movimiento);
    setIsModalOpen(true);
  };

  const handleSubmit = async (movementData: Movimiento) => {
    let mensaje = "";
    try {
      if (currentMovement) {
        await updateRegistroDiarioCaja(
          currentMovement.RegistroDiarioCajaId,
          movementData
        );
        mensaje = "Registro actualizado exitosamente";
      } else {
        const response = await createRegistroDiarioCaja(movementData);
        mensaje = response.message || "Registro creado exitosamente";
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
    return <div>No tienes permiso para ver los registros diarios de caja.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Registro Diario de Caja"
        subtitle={`${movimientosData.pagination.totalItems || 0} registros`}
        icon={CalendarDays}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg">
          Error: {error}
        </div>
      )}
      <FilterPanel
        fechaDesde={filtros.fechaDesde}
        fechaHasta={filtros.fechaHasta}
        onFechaDesdeChange={(v) =>
          setFiltros((p) => ({ ...p, fechaDesde: v }))
        }
        onFechaHastaChange={(v) =>
          setFiltros((p) => ({ ...p, fechaHasta: v }))
        }
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
      >
        <FilterSelect
          label="Caja"
          value={filtros.cajaId}
          onChange={(v) => setFiltros((p) => ({ ...p, cajaId: v }))}
          options={cajas
            .slice()
            .sort((a, b) => a.CajaDescripcion.localeCompare(b.CajaDescripcion))
            .map((c) => ({ value: c.CajaId, label: c.CajaDescripcion }))}
        />
        <FilterSelect
          label="Tipo Gasto"
          value={filtros.tipoGastoId}
          onChange={(v) =>
            setFiltros((p) => ({ ...p, tipoGastoId: v, tipoGastoGrupoId: "" }))
          }
          options={tiposGasto.map((t) => ({
            value: t.TipoGastoId,
            label: t.TipoGastoDescripcion,
          }))}
        />
        <FilterSelect
          label="Grupo Gasto"
          value={filtros.tipoGastoGrupoId}
          onChange={(v) =>
            setFiltros((p) => ({ ...p, tipoGastoGrupoId: v }))
          }
          options={gruposFiltrados.map((g) => ({
            value: g.TipoGastoGrupoId,
            label: g.TipoGastoGrupoDescripcion,
          }))}
        />
      </FilterPanel>
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <MovementsList
        movimientos={movimientosData.movimientos}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentMovement={currentMovement}
        onSubmit={handleSubmit}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
          setCurrentPage(1);
        }}
        disableEdit={true}
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
