import { Banknote } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getPagosAdmin,
  deletePagoAdmin,
  searchPagosAdmin,
  createPagoAdmin,
  updatePagoAdmin,
} from "../../services/pagoadmin.service";
import PagoAdminList, {
  type PagoAdmin,
} from "../../components/pagoadmin/PagoAdminList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import FilterPanel, { FilterSelect } from "../../components/common/FilterPanel";
import { getCajas } from "../../services/cajas.service";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";
import { exportarExcel } from "../../utils/excelExport";

interface CajaOption {
  CajaId: number;
  CajaDescripcion: string;
}

interface Filtros {
  fechaDesde: string;
  fechaHasta: string;
  cajaOrigenId: string;
  cajaId: string;
}

const FILTROS_VACIOS: Filtros = {
  fechaDesde: "",
  fechaHasta: "",
  cajaOrigenId: "",
  cajaId: "",
};

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

export default function PagoAdminPage() {
  const [pagosAdminData, setPagosAdminData] = useState<{
    pagosAdmin: PagoAdmin[];
    pagination: Pagination;
  }>({ pagosAdmin: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentPagoAdmin, setCurrentPagoAdmin] = useState<PagoAdmin | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("PagoAdminId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [appliedFiltros, setAppliedFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [exporting, setExporting] = useState(false);
  const [cajas, setCajas] = useState<CajaOption[]>([]);
  const puedeCrear = usePermiso("PAGOADMIN", "crear");
  const puedeEditar = usePermiso("PAGOADMIN", "editar");
  const puedeEliminar = usePermiso("PAGOADMIN", "eliminar");
  const puedeLeer = usePermiso("PAGOADMIN", "leer");

  const fetchPagosAdmin = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchPagosAdmin(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder,
          appliedFiltros
        );
      } else {
        data = await getPagosAdmin(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder,
          appliedFiltros
        );
      }
      setPagosAdminData({
        pagosAdmin: data.data,
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
    fetchPagosAdmin();
  }, [fetchPagosAdmin]);

  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const cajasResp = await getCajas(1, 1000);
        setCajas(cajasResp.data || []);
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

  const handleDelete = async (pagoAdmin: PagoAdmin) => {
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
          await deletePagoAdmin(pagoAdmin.PagoAdminId);
          Swal.fire({
            icon: "success",
            title: "Pago admin eliminado exitosamente",
          });
          fetchPagosAdmin();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el pago admin";
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
    setCurrentPagoAdmin(null);
    setIsModalOpen(true);
  };

  const handleEdit = (pagoAdmin: PagoAdmin) => {
    setCurrentPagoAdmin(pagoAdmin);
    setIsModalOpen(true);
  };

  const handleSubmit = async (pagoAdminData: PagoAdmin) => {
    let mensaje = "";
    try {
      if (currentPagoAdmin) {
        await updatePagoAdmin(
          currentPagoAdmin.PagoAdminId,
          pagoAdminData
        );
        mensaje = "Pago admin actualizado exitosamente";
      } else {
        const response = await createPagoAdmin(pagoAdminData);
        mensaje = response.message || "Pago admin creado exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchPagosAdmin();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Error desconocido");
      }
    }
  };

  // Exporta a Excel todos los registros que coinciden con la búsqueda y los
  // filtros aplicados (no solo la página visible).
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      // Traer todo en una sola página, respetando búsqueda/filtros/orden actuales
      const limit = Math.max(pagosAdminData.pagination.totalItems || 0, 100000);
      let data;
      if (appliedSearchTerm) {
        data = await searchPagosAdmin(
          appliedSearchTerm,
          1,
          limit,
          sortKey,
          sortOrder,
          appliedFiltros
        );
      } else {
        data = await getPagosAdmin(1, limit, sortKey, sortOrder, appliedFiltros);
      }

      const registros: PagoAdmin[] = data.data || [];
      if (registros.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Sin datos",
          text: "No hay registros para exportar con los filtros actuales.",
        });
        return;
      }

      const fechaArchivo = new Date().toISOString().slice(0, 10);
      await exportarExcel<PagoAdmin>({
        nombreArchivo: `PagosAdmin_${fechaArchivo}.xlsx`,
        nombreHoja: "Pagos Admin",
        filas: registros,
        columnas: [
          { header: "ID", value: (p) => Number(p.PagoAdminId), ancho: 8 },
          {
            header: "Caja Origen",
            value: (p) => p.CajaOrigenDescripcion || "",
            ancho: 25,
          },
          {
            header: "Monto Caja Origen",
            value: (p) =>
              p.MontoCajaOrigen !== null && p.MontoCajaOrigen !== undefined
                ? Number(p.MontoCajaOrigen)
                : null,
            ancho: 18,
            formato: "#,##0",
          },
          {
            header: "Caja Destino",
            value: (p) => p.CajaDescripcion || "",
            ancho: 25,
          },
          {
            header: "Monto Caja Destino",
            value: (p) =>
              p.MontoCajaDestino !== null && p.MontoCajaDestino !== undefined
                ? Number(p.MontoCajaDestino)
                : null,
            ancho: 18,
            formato: "#,##0",
          },
          {
            header: "Fecha",
            value: (p) =>
              p.PagoAdminFecha
                ? new Date(p.PagoAdminFecha).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
            ancho: 18,
          },
          {
            header: "Detalle",
            value: (p) => p.PagoAdminDetalle || "",
            ancho: 50,
          },
          {
            header: "Monto",
            value: (p) => Number(p.PagoAdminMonto) || 0,
            ancho: 15,
            formato: "#,##0",
            totalizar: true,
          },
          { header: "Usuario", value: (p) => Number(p.UsuarioId), ancho: 10 },
        ],
      });
    } catch (err) {
      const e = err as { message?: string };
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: e?.message || "No se pudo generar el archivo Excel.",
      });
    } finally {
      setExporting(false);
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
    return <div>No tienes permiso para ver los pagos admin.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Pagos Administrador"
        subtitle={`${pagosAdminData.pagination.totalItems || 0} registros`}
        icon={Banknote}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
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
          label="Caja Origen"
          value={filtros.cajaOrigenId}
          onChange={(v) => setFiltros((p) => ({ ...p, cajaOrigenId: v }))}
          options={cajas
            .slice()
            .sort((a, b) => a.CajaDescripcion.localeCompare(b.CajaDescripcion))
            .map((c) => ({ value: c.CajaId, label: c.CajaDescripcion }))}
        />
        <FilterSelect
          label="Caja Destino"
          value={filtros.cajaId}
          onChange={(v) => setFiltros((p) => ({ ...p, cajaId: v }))}
          options={cajas
            .slice()
            .sort((a, b) => a.CajaDescripcion.localeCompare(b.CajaDescripcion))
            .map((c) => ({ value: c.CajaId, label: c.CajaDescripcion }))}
        />
      </FilterPanel>
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <PagoAdminList
        pagosAdmin={pagosAdminData.pagosAdmin}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentPagoAdmin={currentPagoAdmin}
        onSubmit={handleSubmit}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key, order) => {
          setSortKey(key);
          setSortOrder(order);
          setCurrentPage(1);
        }}
        disableEdit={false}
        onExport={handleExportExcel}
        exporting={exporting}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={pagosAdminData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={pagosAdminData.pagination.totalItems}
        currentItems={pagosAdminData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
