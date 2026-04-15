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
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Pagination {
  totalItems: number;
  totalPages: number;
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
          sortOrder
        );
      } else {
        data = await getPagosAdmin(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
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
  }, [currentPage, appliedSearchTerm, itemsPerPage, sortKey, sortOrder]);

  useEffect(() => {
    fetchPagosAdmin();
  }, [fetchPagosAdmin]);

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

  const handleDelete = async (pagoAdmin: PagoAdmin) => {
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
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <PagoAdminList
        pagosAdmin={pagosAdminData.pagosAdmin}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={pagosAdminData.pagination}
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
