import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import SearchButton from "../common/Input/SearchButton";
import ActionButton from "../common/Button/ActionButton";
import DataTable from "../common/Table/DataTable";
import { getNominas } from "../../services/nomina.service";
import { getCajas } from "../../services/cajas.service";
import { getUsuarios } from "../../services/usuarios.service";
import { getNominaById } from "../../services/nomina.service";
import { getColegioCursos } from "../../services/colegio.service";
import { formatMiles, formatMilesWithDecimals } from "../../utils/utils";

interface ColegioCobranza {
  id: string | number;
  ColegioCobranzaId: string | number;
  CajaId: string | number;
  ColegioCobranzaFecha: string;
  NominaId: string | number;
  ColegioCobranzaMesPagado: string;
  ColegioCobranzaMes: string;
  ColegioCobranzaDiasMora: number;
  ColegioCobranzaExamen: string;
  UsuarioId: string | number;
  ColegioCobranzaDescuento: number;
  CajaDescripcion?: string;
  NominaNombre?: string;
  NominaApellido?: string;
  UsuarioNombre?: string;
  [key: string]: unknown;
}

interface Caja {
  CajaId: number;
  CajaDescripcion: string;
}

interface Nomina {
  NominaId: number;
  NominaNombre: string;
  NominaApellido: string;
}

interface Usuario {
  UsuarioId: number;
  UsuarioNombre: string;
}

interface Pagination {
  totalItems: number;
}

interface ColegioCobranzasListProps {
  cobranzas: ColegioCobranza[];
  onDelete?: (item: ColegioCobranza) => void;
  onEdit?: (item: ColegioCobranza) => void;
  onCreate?: () => void;
  pagination?: Pagination;
  onSearch: (value: string) => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  currentCobranza?: ColegioCobranza | null;
  onSubmit: (formData: ColegioCobranza) => void;
  searchTerm: string;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onSearchSubmit: () => void;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string, order: "asc" | "desc") => void;
}

export default function ColegioCobranzasList({
  cobranzas,
  onDelete,
  onEdit,
  onCreate,
  pagination,
  onSearch,
  searchTerm,
  onKeyPress,
  onSearchSubmit,
  isModalOpen,
  onCloseModal,
  currentCobranza,
  onSubmit,
  sortKey,
  sortOrder,
  onSort,
}: ColegioCobranzasListProps) {
  const [formData, setFormData] = useState({
    id: "",
    ColegioCobranzaId: "",
    CajaId: "",
    ColegioCobranzaFecha: "",
    NominaId: "",
    ColegioCobranzaMesPagado: "",
    ColegioCobranzaMes: "",
    ColegioCobranzaDiasMora: 0,
    ColegioCobranzaExamen: "",
    UsuarioId: "",
    ColegioCobranzaDescuento: 0,
  });

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [importesPorNomina, setImportesPorNomina] = useState<
    Map<number, number>
  >(new Map());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cajasData, nominasData, usuariosData] = await Promise.all([
          getCajas(1, 1000),
          getNominas(1, 1000),
          getUsuarios(1, 1000),
        ]);
        setCajas(cajasData.data || []);
        setNominas(nominasData.data || []);
        setUsuarios(usuariosData.data || []);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, []);

  // Cargar importes de cursos cuando cambien las cobranzas
  useEffect(() => {
    const loadImportes = async () => {
      if (cobranzas.length === 0) return;

      // Obtener IDs únicos de nóminas
      const nominaIdsUnicos = new Set<number>();
      cobranzas.forEach((c) => {
        if (c.NominaId) {
          nominaIdsUnicos.add(Number(c.NominaId));
        }
      });

      const importesMap = new Map<number, number>();
      await Promise.all(
        Array.from(nominaIdsUnicos).map(async (nominaId) => {
          try {
            const nomina = await getNominaById(nominaId);
            if (nomina && nomina.ColegioId && nomina.ColegioCursoId) {
              const cursos = await getColegioCursos(nomina.ColegioId);
              const curso = cursos.find(
                (c: { ColegioCursoId: number }) =>
                  c.ColegioCursoId === nomina.ColegioCursoId
              );
              if (curso && curso.ColegioCursoImporte) {
                importesMap.set(
                  nominaId,
                  Number(curso.ColegioCursoImporte) || 0
                );
              }
            }
          } catch (error) {
            console.error(
              `Error al cargar importe para nómina ${nominaId}:`,
              error
            );
          }
        })
      );
      setImportesPorNomina(importesMap);
    };

    loadImportes();
  }, [cobranzas]);

  useEffect(() => {
    if (currentCobranza) {
      // Formatear fecha para input type="date"
      const fecha = currentCobranza.ColegioCobranzaFecha
        ? new Date(currentCobranza.ColegioCobranzaFecha)
            .toISOString()
            .split("T")[0]
        : "";
      setFormData({
        id: String(currentCobranza.id ?? currentCobranza.ColegioCobranzaId),
        ColegioCobranzaId: String(currentCobranza.ColegioCobranzaId),
        CajaId: currentCobranza.CajaId ? String(currentCobranza.CajaId) : "",
        ColegioCobranzaFecha: fecha,
        NominaId: currentCobranza.NominaId
          ? String(currentCobranza.NominaId)
          : "",
        ColegioCobranzaMesPagado:
          currentCobranza.ColegioCobranzaMesPagado || "",
        ColegioCobranzaMes: currentCobranza.ColegioCobranzaMes || "",
        ColegioCobranzaDiasMora: currentCobranza.ColegioCobranzaDiasMora || 0,
        ColegioCobranzaExamen: currentCobranza.ColegioCobranzaExamen || "",
        UsuarioId: currentCobranza.UsuarioId
          ? String(currentCobranza.UsuarioId)
          : "",
        ColegioCobranzaDescuento: currentCobranza.ColegioCobranzaDescuento || 0,
      });
    } else {
      setFormData({
        id: "",
        ColegioCobranzaId: "",
        CajaId: "",
        ColegioCobranzaFecha: "",
        NominaId: "",
        ColegioCobranzaMesPagado: "",
        ColegioCobranzaMes: "",
        ColegioCobranzaDiasMora: 0,
        ColegioCobranzaExamen: "",
        UsuarioId: "",
        ColegioCobranzaDescuento: 0,
      });
    }
  }, [currentCobranza]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "ColegioCobranzaDiasMora" ||
        name === "ColegioCobranzaDescuento"
          ? Number(value) || 0
          : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dataToSubmit: Partial<ColegioCobranza> = {
      id: formData.id,
      ColegioCobranzaId: formData.ColegioCobranzaId,
      CajaId: formData.CajaId,
      ColegioCobranzaFecha: formData.ColegioCobranzaFecha,
      NominaId: formData.NominaId,
      ColegioCobranzaMesPagado: formData.ColegioCobranzaMesPagado,
      ColegioCobranzaMes: formData.ColegioCobranzaMes,
      ColegioCobranzaDiasMora: formData.ColegioCobranzaDiasMora,
      ColegioCobranzaExamen: formData.ColegioCobranzaExamen,
      UsuarioId: formData.UsuarioId,
      ColegioCobranzaDescuento: formData.ColegioCobranzaDescuento,
    };
    onSubmit(dataToSubmit as ColegioCobranza);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCloseModal();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Función para calcular el total abonado
  const calcularTotalAbonado = (cobranza: ColegioCobranza): number => {
    const importe = importesPorNomina.get(Number(cobranza.NominaId)) || 0;
    const mes = Number(cobranza.ColegioCobranzaMes) || 0;
    const subtotalCuota = importe * mes;
    const diasMora = Number(cobranza.ColegioCobranzaDiasMora) || 0;
    const multa = diasMora * 1000;
    const examen = Number(cobranza.ColegioCobranzaExamen) || 0;
    const descuento = Number(cobranza.ColegioCobranzaDescuento) || 0;
    const total = subtotalCuota + multa + examen - descuento;
    return Math.max(0, total);
  };

  const columns = [
    { key: "ColegioCobranzaId", label: "ID" },
    {
      key: "CajaDescripcion",
      label: "Caja",
      render: (cobranza: ColegioCobranza) =>
        cobranza.CajaDescripcion || cobranza.CajaId,
    },
    {
      key: "ColegioCobranzaFecha",
      label: "Fecha",
      render: (cobranza: ColegioCobranza) =>
        formatDate(cobranza.ColegioCobranzaFecha),
    },
    {
      key: "NominaNombre",
      label: "Nomina",
      render: (cobranza: ColegioCobranza) =>
        cobranza.NominaNombre && cobranza.NominaApellido
          ? `${cobranza.NominaNombre} ${cobranza.NominaApellido}`
          : cobranza.NominaId,
    },
    { key: "ColegioCobranzaMesPagado", label: "Mes Pagado" },
    { key: "ColegioCobranzaMes", label: "Mes" },
    { key: "ColegioCobranzaDiasMora", label: "Días Mora" },
    {
      key: "ColegioCobranzaExamen",
      label: "Examen",
      render: (cobranza: ColegioCobranza) => {
        if (!cobranza.ColegioCobranzaExamen) return "";
        const value = Number(cobranza.ColegioCobranzaExamen);
        return isNaN(value)
          ? cobranza.ColegioCobranzaExamen
          : `Gs. ${formatMiles(value)}`;
      },
    },
    {
      key: "ColegioCobranzaDescuento",
      label: "Descuento",
      render: (cobranza: ColegioCobranza) => {
        if (!cobranza.ColegioCobranzaDescuento) return "Gs. 0";
        const value = Number(cobranza.ColegioCobranzaDescuento);
        return isNaN(value)
          ? cobranza.ColegioCobranzaDescuento
          : `Gs. ${formatMiles(value)}`;
      },
    },
    {
      key: "TotalAbonado",
      label: "Total Abonado",
      render: (cobranza: ColegioCobranza) => {
        const total = calcularTotalAbonado(cobranza);
        return `Gs. ${formatMilesWithDecimals(total)}`;
      },
    },
    {
      key: "UsuarioId",
      label: "Usuario",
      render: (cobranza: ColegioCobranza) => cobranza.UsuarioId,
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchButton
            searchTerm={searchTerm}
            onSearch={onSearch}
            onKeyPress={onKeyPress}
            onSearchSubmit={onSearchSubmit}
            placeholder="Buscar cobranzas..."
          />
        </div>
        <div className="py-4">
          {onCreate && (
            <ActionButton
              label="Nueva Cobranza"
              onClick={onCreate}
              icon={Plus}
            />
          )}
        </div>
      </div>
      <DataTable<ColegioCobranza>
        columns={columns}
        data={cobranzas}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No se encontraron cobranzas"
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleBackdropClick}
        >
          <div className="absolute inset-0 bg-black opacity-50" />
          <div className="relative w-full max-w-4xl max-h-full z-10">
            <form
              onSubmit={handleSubmit}
              className="relative bg-white rounded-lg shadow max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between p-4 border-b rounded-t">
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentCobranza
                    ? `Editar cobranza: ${currentCobranza.ColegioCobranzaId}`
                    : "Crear nueva cobranza"}
                </h3>
                <button
                  type="button"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center"
                  onClick={onCloseModal}
                >
                  <svg
                    className="size-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-6 gap-6">
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="CajaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Caja
                    </label>
                    <select
                      name="CajaId"
                      id="CajaId"
                      value={formData.CajaId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {cajas.map((c) => (
                        <option key={c.CajaId} value={c.CajaId}>
                          {c.CajaDescripcion}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaFecha"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Fecha
                    </label>
                    <input
                      type="date"
                      name="ColegioCobranzaFecha"
                      id="ColegioCobranzaFecha"
                      value={formData.ColegioCobranzaFecha}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="NominaId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Nomina
                    </label>
                    <select
                      name="NominaId"
                      id="NominaId"
                      value={formData.NominaId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {nominas.map((n) => (
                        <option key={n.NominaId} value={n.NominaId}>
                          {n.NominaNombre} {n.NominaApellido}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaMesPagado"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Mes Pagado
                    </label>
                    <input
                      type="text"
                      name="ColegioCobranzaMesPagado"
                      id="ColegioCobranzaMesPagado"
                      value={formData.ColegioCobranzaMesPagado}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaMes"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Mes
                    </label>
                    <input
                      type="text"
                      name="ColegioCobranzaMes"
                      id="ColegioCobranzaMes"
                      value={formData.ColegioCobranzaMes}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaDiasMora"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Días Mora
                    </label>
                    <input
                      type="number"
                      name="ColegioCobranzaDiasMora"
                      id="ColegioCobranzaDiasMora"
                      value={formData.ColegioCobranzaDiasMora}
                      onChange={handleInputChange}
                      min="0"
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                      required
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaExamen"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Examen
                    </label>
                    <input
                      type="text"
                      name="ColegioCobranzaExamen"
                      id="ColegioCobranzaExamen"
                      value={formData.ColegioCobranzaExamen}
                      onChange={handleInputChange}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="UsuarioId"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Usuario
                    </label>
                    <select
                      name="UsuarioId"
                      id="UsuarioId"
                      value={formData.UsuarioId}
                      onChange={handleInputChange}
                      required
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    >
                      <option value="">Seleccione...</option>
                      {usuarios.map((u) => (
                        <option key={u.UsuarioId} value={u.UsuarioId}>
                          {u.UsuarioNombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label
                      htmlFor="ColegioCobranzaDescuento"
                      className="block mb-2 text-sm font-medium text-gray-900"
                    >
                      Descuento
                    </label>
                    <input
                      type="number"
                      name="ColegioCobranzaDescuento"
                      id="ColegioCobranzaDescuento"
                      value={formData.ColegioCobranzaDescuento}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-ring focus:border-primary block w-full p-2.5"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center p-6 space-x-2 border-t border-gray-200 rounded-b">
                <ActionButton
                  label={currentCobranza ? "Actualizar" : "Crear"}
                  type="submit"
                />
                <ActionButton
                  label="Cancelar"
                  variant="secondary"
                  onClick={onCloseModal}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
