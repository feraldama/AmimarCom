import { CalendarCheck, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import CampoFecha from "@/components/common/CampoFecha";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import Modal from "../../components/common/Modal";
import ActionButton from "../../components/common/Button/ActionButton";
import DataTable from "../../components/common/Table/DataTable";
import {
  getCierreDiarioHistorial,
  getCierreDiarioDetail,
  type CierreDiarioDateRow,
  type CierreDiarioDetailRow,
} from "../../services/cierrediario.service";
import { getCajas } from "../../services/cajas.service";
import { usePermiso } from "../../hooks/usePermiso";
import { formatMiles } from "../../utils/utils";

interface CajaOpcion {
  CajaId: number;
  CajaDescripcion: string;
}

interface PaginationData {
  totalItems: number;
  totalPages: number;
  itemsPerPage?: number;
  [key: string]: unknown;
}

type HistorialRow = CierreDiarioDateRow & {
  id: string;
  [key: string]: unknown;
};
type DetailRow = CierreDiarioDetailRow & {
  id: number;
  [key: string]: unknown;
};

const formatFecha = (fecha: string) => {
  // Backend returns YYYY-MM-DD; render dd/mm/yyyy without timezone shifting.
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

export default function CierreDiarioHistorialPage() {
  const puedeLeer = usePermiso("CIERREDIARIO", "leer");

  const [rows, setRows] = useState<CierreDiarioDateRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    totalItems: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cajaId, setCajaId] = useState("");
  const [appliedDesde, setAppliedDesde] = useState("");
  const [appliedHasta, setAppliedHasta] = useState("");
  const [appliedCaja, setAppliedCaja] = useState("");
  // El snapshot guarda una fila por cada caja de la tabla `caja` (no sólo las
  // tipo 1), así que el buscador tiene que ofrecerlas todas.
  const [cajas, setCajas] = useState<CajaOpcion[]>([]);
  const [sortKey, setSortKey] = useState<string>("Fecha");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFecha, setDetailFecha] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<CierreDiarioDetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistorial = useCallback(async () => {
    if (!puedeLeer) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getCierreDiarioHistorial(
        page,
        itemsPerPage,
        appliedDesde || undefined,
        appliedHasta || undefined,
        sortKey,
        sortOrder,
        appliedCaja || undefined
      );
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Error al cargar historial");
    } finally {
      setLoading(false);
    }
  }, [
    puedeLeer,
    page,
    itemsPerPage,
    appliedDesde,
    appliedHasta,
    appliedCaja,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  useEffect(() => {
    if (!puedeLeer) return;
    getCajas(1, 1000)
      .then((data: { data: CajaOpcion[] }) => setCajas(data.data || []))
      .catch((err) => console.error("Error al cargar cajas:", err));
  }, [puedeLeer]);

  // La columna Variación sólo existe con una caja filtrada; si el orden quedó
  // en esa columna y se vuelve a la vista consolidada, hay que soltarlo.
  const resetSortSiSobra = (nuevaCaja: string) => {
    if (!nuevaCaja && sortKey === "Variacion") {
      setSortKey("Fecha");
      setSortOrder("desc");
    }
  };

  const handleApplyFilter = () => {
    setAppliedDesde(fechaDesde);
    setAppliedHasta(fechaHasta);
    setAppliedCaja(cajaId);
    resetSortSiSobra(cajaId);
    setPage(1);
  };

  const handleClearFilter = () => {
    setFechaDesde("");
    setFechaHasta("");
    setCajaId("");
    setAppliedDesde("");
    setAppliedHasta("");
    setAppliedCaja("");
    resetSortSiSobra("");
    setPage(1);
  };

  const handleSort = (key: string, order: "asc" | "desc") => {
    setSortKey(key);
    setSortOrder(order);
    setPage(1);
  };

  const openDetail = async (fecha: string) => {
    setDetailFecha(fecha);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRows([]);
    try {
      const result = await getCierreDiarioDetail(fecha);
      setDetailRows(result.data);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Error al cargar detalle");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!puedeLeer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3" />
        <p className="font-medium">No tienes permiso para ver esta sección.</p>
      </div>
    );
  }

  const detailTotal = detailRows.reduce(
    (s, r) => s + Number(r.CierreDiarioCajaMonto || 0),
    0
  );

  const historialData: HistorialRow[] = rows.map((r) => ({ ...r, id: r.Fecha }));
  const detailData: DetailRow[] = detailRows.map((r) => ({
    ...r,
    id: r.CierreDiarioId,
  }));

  // Con una caja filtrada cada fila es el monto de esa caja, así que la
  // cantidad de cajas siempre sería 1 y el "total" deja de ser una suma.
  const cajaFiltrada = Boolean(appliedCaja);
  const descripcionCajaFiltrada =
    cajas.find((c) => String(c.CajaId) === appliedCaja)?.CajaDescripcion ||
    `Caja ${appliedCaja}`;

  const renderVariacion = (row: HistorialRow) => {
    if (row.Variacion === null || row.Variacion === undefined) {
      return <span className="text-gray-400">—</span>;
    }
    const v = Number(row.Variacion);
    if (v === 0) return <span className="text-gray-500">0</span>;
    return (
      <span className={v > 0 ? "text-success-600" : "text-danger-600"}>
        {v > 0 ? "+" : "-"}
        {formatMiles(Math.abs(v))}
      </span>
    );
  };

  const historialColumns = [
    {
      key: "Fecha",
      label: "Fecha",
      render: (row: HistorialRow) => formatFecha(row.Fecha),
    },
    ...(cajaFiltrada
      ? []
      : [
          {
            key: "CantCajas",
            label: "Cantidad de Cajas",
            render: (row: HistorialRow) => row.CantCajas,
          },
        ]),
    {
      key: "Total",
      label: cajaFiltrada ? "Monto Gs." : "Total Gs.",
      render: (row: HistorialRow) => formatMiles(Number(row.Total)),
    },
    // La variación se muestra sólo al filtrar por caja: es la que pidió el
    // cliente y la que se lee sin ambigüedad (el saldo de esa caja contra su
    // cierre anterior).
    ...(cajaFiltrada
      ? [
          {
            key: "Variacion",
            label: "Variación Gs.",
            render: renderVariacion,
          },
        ]
      : []),
  ];

  const detailColumns = [
    {
      key: "CajaId",
      label: "ID",
      render: (row: DetailRow) => row.CajaId,
    },
    {
      key: "CajaDescripcion",
      label: "Caja",
      render: (row: DetailRow) => row.CajaDescripcion,
    },
    {
      key: "CierreDiarioCajaMonto",
      label: "Monto Gs.",
      render: (row: DetailRow) =>
        formatMiles(Number(row.CierreDiarioCajaMonto)),
    },
  ];

  return (
    <div className="w-full">
      <PageHeader
        title="Historial de Cierres Diarios"
        subtitle={
          cajaFiltrada
            ? `${pagination.totalItems} cierre(s) de ${descripcionCajaFiltrada}`
            : `${pagination.totalItems} cierre(s) registrado(s)`
        }
        icon={CalendarCheck}
      />

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg text-sm text-danger-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label
              htmlFor="fechaDesde"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Desde
            </label>
            <CampoFecha
              id="fechaDesde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="fechaHasta"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Hasta
            </label>
            <CampoFecha
              id="fechaHasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="cajaId"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Caja
            </label>
            <select
              id="cajaId"
              value={cajaId}
              onChange={(e) => setCajaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
            >
              <option value="">Todas las cajas</option>
              {cajas.map((c) => (
                <option key={c.CajaId} value={c.CajaId}>
                  {c.CajaDescripcion}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <ActionButton label="Filtrar" onClick={handleApplyFilter} />
            <ActionButton
              label="Limpiar"
              variant="secondary"
              onClick={handleClearFilter}
            />
          </div>
        </div>
      </div>

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        <DataTable<HistorialRow>
          columns={historialColumns}
          data={historialData}
          emptyMessage="No se encontraron cierres"
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
          customActions={(row) => (
            <button
              type="button"
              className="text-primary hover:underline text-xs cursor-pointer"
              onClick={() => openDetail(row.Fecha)}
            >
              Ver detalle
            </button>
          )}
        />
      </div>

      <Pagination
        currentPage={page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setPage(1);
        }}
        totalItems={pagination.totalItems}
        currentItems={pagination.itemsPerPage}
      />

      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          detailFecha
            ? `Cierre del ${formatFecha(detailFecha)}`
            : "Detalle del cierre"
        }
        size="2xl"
      >
        {detailLoading ? (
          <p className="text-center text-gray-500 py-6">Cargando detalle...</p>
        ) : detailRows.length === 0 ? (
          <p className="text-center text-gray-400 py-6">Sin datos</p>
        ) : (
          <>
            <DataTable<DetailRow>
              columns={detailColumns}
              data={detailData}
              emptyMessage="Sin datos"
              actions={false}
            />
            <div className="mt-3 flex justify-end px-4">
              <span className="text-sm font-semibold text-gray-900">
                Total: {formatMiles(detailTotal)}
              </span>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
