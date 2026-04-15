import { Truck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getPagosTrans,
  deletePagoTrans,
  searchPagosTrans,
  createPagoTrans,
  updatePagoTrans,
  type PagoTrans,
} from "../../services/pagotrans.service";
import PagosTransporteList from "../../components/pagotrans/PagosTransporteList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function PagosTransportePage() {
  const [pagosTransData, setPagosTransData] = useState<{
    pagosTrans: PagoTrans[];
    pagination: Pagination;
  }>({ pagosTrans: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentPagoTrans, setCurrentPagoTrans] = useState<PagoTrans | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("PagoTransId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const puedeCrear = usePermiso("PAGOTRANS", "crear");
  const puedeEditar = usePermiso("PAGOTRANS", "editar");
  const puedeEliminar = usePermiso("PAGOTRANS", "eliminar");
  const puedeLeer = usePermiso("PAGOTRANS", "leer");

  const fetchPagosTrans = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchPagosTrans(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getPagosTrans(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setPagosTransData({
        pagosTrans: data.data.map((pago: PagoTrans) => ({
          ...pago,
          id: pago.PagoTransId,
        })),
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
    fetchPagosTrans();
  }, [fetchPagosTrans]);

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

  const handleDelete = async (pagoTrans: PagoTrans) => {
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
          await deletePagoTrans(pagoTrans.PagoTransId!);
          Swal.fire({
            icon: "success",
            title: "Pago eliminado exitosamente",
          });
          fetchPagosTrans();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el pago";
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
    setCurrentPagoTrans(null);
    setIsModalOpen(true);
  };

  const handleEdit = (pagoTrans: PagoTrans) => {
    setCurrentPagoTrans(pagoTrans);
    setIsModalOpen(true);
  };

  const handleSubmit = async (pagoTransData: PagoTrans) => {
    let mensaje = "";
    try {
      if (currentPagoTrans) {
        await updatePagoTrans(currentPagoTrans.PagoTransId!, pagoTransData);
        mensaje = "Pago actualizado exitosamente";
      } else {
        const response = await createPagoTrans(pagoTransData);
        mensaje = response.message || "Pago creado exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchPagosTrans();
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
    return <div>No tienes permiso para ver los pagos de transporte.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Pagos de Transporte"
        subtitle={`${pagosTransData.pagination.totalItems || 0} registros`}
        icon={Truck}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <PagosTransporteList
        pagosTrans={pagosTransData.pagosTrans}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={pagosTransData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentPagoTrans={currentPagoTrans}
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
        totalPages={pagosTransData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={pagosTransData.pagination.totalItems}
        currentItems={pagosTransData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
