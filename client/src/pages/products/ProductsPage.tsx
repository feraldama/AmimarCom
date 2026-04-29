import { Archive } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
  getProductosPaginated,
  deleteProducto,
  searchProductos,
  createProducto,
  updateProducto,
} from "../../services/productos.service";
import ProductsList from "../../components/products/ProductsList";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import Swal from "sweetalert2";
import { usePermiso } from "../../hooks/usePermiso";

// Tipos auxiliares
interface Producto {
  ProductoId: number;
  ProductoCodigo: string;
  ProductoNombre: string;
  ProductoPrecioVenta: number;
  ProductoPrecioVentaMayorista?: number;
  ProductoPrecioUnitario?: number;
  ProductoPrecioPromedio?: number;
  ProductoStock: number;
  ProductoStockUnitario?: number;
  ProductoCantidadCaja?: number;
  ProductoIVA?: number;
  ProductoStockMinimo?: number;
  ProductoImagen?: string;
  ProductoImagen_GXI?: string;
  LocalId: number;
  LocalNombre: string;
  [key: string]: unknown;
}

interface Pagination {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

type ProductoForm = Partial<Producto>;

export default function ProductsPage() {
  const [productosData, setProductosData] = useState<{
    productos: Producto[];
    pagination: Pagination;
  }>({ productos: [], pagination: { totalItems: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Producto | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const puedeCrear = usePermiso("PRODUCTOS", "crear");
  const puedeEditar = usePermiso("PRODUCTOS", "editar");
  const puedeEliminar = usePermiso("PRODUCTOS", "eliminar");
  const puedeLeer = usePermiso("PRODUCTOS", "leer");

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (appliedSearchTerm) {
        data = await searchProductos(
          appliedSearchTerm,
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      } else {
        data = await getProductosPaginated(
          currentPage,
          itemsPerPage,
          sortKey,
          sortOrder
        );
      }
      setProductosData({
        productos: data.data,
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
    fetchProductos();
  }, [fetchProductos]);

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

  const handleDelete = async (id: number) => {
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
          await deleteProducto(id);
          Swal.fire({
            icon: "success",
            title: "Producto eliminado exitosamente",
          });
          setProductosData((prev) => ({
            ...prev,
            productos: prev.productos.filter(
              (producto) => Number(producto.ProductoId) !== id
            ),
          }));
        } catch (error: unknown) {
          const err = error as { message?: string };
          const msg = err?.message || "No se pudo eliminar el producto";
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
    setCurrentProduct(null); // Indica que es un nuevo producto
    setIsModalOpen(true);
  };

  const handleEdit = (product: Producto) => {
    setCurrentProduct({ ...product, ProductoId: Number(product.ProductoId) });
    setIsModalOpen(true);
  };

  const handleSubmit = async (productData: ProductoForm) => {
    let mensaje = "";
    try {
      if (currentProduct) {
        await updateProducto(currentProduct.ProductoId, productData);
        mensaje = "Producto actualizado exitosamente";
      } else {
        const response = await createProducto(productData);
        mensaje = response.message || "Producto creado exitosamente";
      }
      setIsModalOpen(false);
      Swal.fire({
        position: "top-end",
        icon: "success",
        title: mensaje,
        showConfirmButton: false,
        timer: 2000,
      });
      fetchProductos();
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

  if (!puedeLeer) return <div>No tienes permiso para ver los productos</div>;

  return (
    <div className="w-full">
      <PageHeader
        title="Gestión de Productos"
        subtitle={`${productosData.pagination.totalItems || 0} registros`}
        icon={Archive}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg">
          Error: {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      <ProductsList
        productos={productosData.productos.map((p) => ({
          ...p,
          ProductoId: Number(p.ProductoId),
          LocalNombre: typeof p.LocalNombre === "string" ? p.LocalNombre : "",
        }))}
        onDelete={
          puedeEliminar ? (p) => handleDelete(Number(p.ProductoId)) : undefined
        }
        onEdit={
          puedeEditar
            ? (p) =>
                handleEdit({
                  ...p,
                  ProductoId: Number(p.ProductoId),
                  LocalNombre:
                    typeof p.LocalNombre === "string" ? p.LocalNombre : "",
                })
            : undefined
        }
        onCreate={puedeCrear ? handleCreate : undefined}        onSearch={handleSearch}
        searchTerm={searchTerm}
        onKeyPress={handleKeyPress}
        onSearchSubmit={applySearch}
        isModalOpen={isModalOpen}
        onCloseModal={() => setIsModalOpen(false)}
        currentProduct={currentProduct}
        onSubmit={handleSubmit}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={(key: string, order: "asc" | "desc") => {
          setSortKey(key);
          setSortOrder(order);
          setCurrentPage(1);
        }}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={productosData.pagination.totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={productosData.pagination.totalItems}
        currentItems={productosData.pagination.itemsPerPage}
      />
      </div>
    </div>
  );
}
