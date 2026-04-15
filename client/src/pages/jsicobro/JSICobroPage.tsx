import { CheckCircle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getJSICobros,
  deleteJSICobro,
  searchJSICobros,
  createJSICobro,
  updateJSICobro,
  type JSICobro,
} from "../../services/jsicobro.service";
import JSICobroList from "../../components/jsicobro/JSICobroList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

interface Pagination {
  totalItems: number;
  totalPages: number;
  [key: string]: unknown;
}

export default function JSICobroPage() {
  const [jsicobrosData, setJSICobrosData] = useState<{
    jsicobros: JSICobro[];
    pagination: Pagination;
  }>({ jsicobros: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [currentJSICobro, setCurrentJSICobro] = useState<JSICobro | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string>("JSICobroId");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const puedeCrear = usePermiso("JSICOBRO", "crear");
  const puedeEditar = usePermiso("JSICOBRO", "editar");
  const puedeEliminar = usePermiso("JSICOBRO", "eliminar");
  const puedeLeer = usePermiso("JSICOBRO", "leer");

  const fetchJSICobros = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchJSICobros(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getJSICobros(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setJSICobrosData({
        jsicobros: data.data.map((cobro: JSICobro) => ({
          ...cobro,
          id: cobro.JSICobroId,
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
    fetchJSICobros();
  }, [fetchJSICobros]);

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

  const handleDelete = async (jsicobro: JSICobro) => {
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
          await deleteJSICobro(jsicobro.JSICobroId!);
          Swal.fire({
            icon: "success",
            title: "Cobro eliminado exitosamente",
          });
          fetchJSICobros();
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el cobro";
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
    setCurrentJSICobro(null);
    setIsModalOpen(true);
  };

  const handleEdit = (jsicobro: JSICobro) => {
    setCurrentJSICobro(jsicobro);
    setIsModalOpen(true);
  };

  const handleSubmit = async (jsicobroData: JSICobro) => {
    let mensaje = "";
    try {
      if (currentJSICobro) {
        await updateJSICobro(currentJSICobro.JSICobroId!, jsicobroData);
        mensaje = "Cobro actualizado exitosamente";
      } else {
        const response = await createJSICobro(jsicobroData);
        mensaje = response.message || "Cobro creado exitosamente";
      }

      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchJSICobros();
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
    return <div>No tienes permiso para ver los cobros de JSI.</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Cobros JSI"
        subtitle={`${jsicobrosData.pagination.totalItems || 0} registros`}
        icon={CheckCircle}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <JSICobroList
        jsicobros={jsicobrosData.jsicobros}
        onDelete={puedeEliminar ? handleDelete : undefined}
        onEdit={puedeEditar ? handleEdit : undefined}
        onCreate={puedeCrear ? handleCreate : undefined}
        pagination={jsicobrosData.pagination}
        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentJSICobro={currentJSICobro}
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
        totalPages={jsicobrosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={jsicobrosData.pagination.totalItems}
        currentItems={jsicobrosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
