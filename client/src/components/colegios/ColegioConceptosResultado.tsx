import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  getConceptosResultado,
  addConceptoResultado,
  deleteConceptoResultado,
  type ConceptoResultadoColegio,
  type RubroResultado,
} from "../../services/colegio.service";

interface GrupoGasto {
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TipoGastoGrupoDescripcion: string;
}

interface Props {
  colegioId: string | number;
  /** Todos los grupos de gasto (ingreso y egreso). */
  grupos: GrupoGasto[];
}

// Rubros del reporte "Estado de Resultados Colegios" y el tipo de gasto
// que admite cada uno (2 = ingreso, 1 = egreso)
const RUBROS: { rubro: RubroResultado; titulo: string; tipoGastoId: number }[] = [
  { rubro: "INGRESO", titulo: "Ingresos adicionales", tipoGastoId: 2 },
  { rubro: "RETIRO", titulo: "Retiros", tipoGastoId: 1 },
  { rubro: "SALARIO", titulo: "Salarios y anticipos", tipoGastoId: 1 },
];

export default function ColegioConceptosResultado({ colegioId, grupos }: Props) {
  const [conceptos, setConceptos] = useState<ConceptoResultadoColegio[]>([]);
  const [loading, setLoading] = useState(true);
  const [rubro, setRubro] = useState<RubroResultado>("RETIRO");
  const [grupoId, setGrupoId] = useState("");

  useEffect(() => {
    setLoading(true);
    getConceptosResultado(colegioId)
      .then(setConceptos)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [colegioId]);

  const tipoGastoId = RUBROS.find((r) => r.rubro === rubro)!.tipoGastoId;
  const opciones = grupos
    .filter(
      (g) =>
        Number(g.TipoGastoId) === tipoGastoId &&
        !conceptos.some(
          (c) =>
            c.TipoGastoId === Number(g.TipoGastoId) &&
            c.TipoGastoGrupoId === Number(g.TipoGastoGrupoId)
        )
    )
    .sort((a, b) =>
      (a.TipoGastoGrupoDescripcion || "").localeCompare(b.TipoGastoGrupoDescripcion || "", "es")
    );

  const mostrarError = (err: unknown) =>
    Swal.fire({
      icon: "warning",
      title: "No permitido",
      text: err instanceof Error ? err.message : "Error al guardar",
    });

  const agregar = async () => {
    if (!grupoId) return;
    try {
      setConceptos(
        await addConceptoResultado(colegioId, {
          TipoGastoId: tipoGastoId,
          TipoGastoGrupoId: Number(grupoId),
          ColegioGastoRubro: rubro,
        })
      );
      setGrupoId("");
    } catch (err) {
      mostrarError(err);
    }
  };

  const quitar = async (c: ConceptoResultadoColegio) => {
    const confirm = await Swal.fire({
      title: "¿Quitar el concepto?",
      text: `${c.TipoGastoGrupoDescripcion.trim()} deja de sumar al estado de resultados del colegio`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d9488",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      setConceptos(await deleteConceptoResultado(colegioId, c.TipoGastoId, c.TipoGastoGrupoId));
    } catch (err) {
      mostrarError(err);
    }
  };

  return (
    <div className="mt-8">
      <h4 className="text-lg font-semibold mb-1">Conceptos del estado de resultados</h4>
      <p className="text-xs text-gray-500 mb-3">
        Grupos de caja que suman a este colegio en el reporte. Las cobranzas
        (el grupo de gasto de arriba) cuentan siempre como ingreso.
      </p>
      {loading ? (
        <div className="text-gray-500 text-sm">Cargando conceptos...</div>
      ) : (
        <div className="space-y-3">
          {RUBROS.map((r) => {
            const lista = conceptos.filter((c) => c.ColegioGastoRubro === r.rubro);
            return (
              <div key={r.rubro}>
                <div className="text-sm font-medium text-gray-700">{r.titulo}</div>
                {lista.length === 0 ? (
                  <div className="text-gray-400 text-xs py-1 px-1">Ninguno</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {lista.map((c) => (
                      <li
                        key={`${c.TipoGastoId}-${c.TipoGastoGrupoId}`}
                        className="py-1.5 px-1 flex items-center gap-2 hover:bg-gray-100 rounded text-sm"
                      >
                        <span className="flex-1">{c.TipoGastoGrupoDescripcion.trim()}</span>
                        <button
                          type="button"
                          className="text-destructive cursor-pointer"
                          title="Quitar"
                          onClick={() => quitar(c)}
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <select
              className="border rounded px-2 py-1 text-sm sm:w-48"
              value={rubro}
              onChange={(e) => {
                setRubro(e.target.value as RubroResultado);
                setGrupoId("");
              }}
            >
              {RUBROS.map((r) => (
                <option key={r.rubro} value={r.rubro}>{r.titulo}</option>
              ))}
            </select>
            <select
              className="border rounded px-2 py-1 text-sm flex-1"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
            >
              <option value="">Seleccioná un grupo...</option>
              {opciones.map((g) => (
                <option key={g.TipoGastoGrupoId} value={g.TipoGastoGrupoId}>
                  {g.TipoGastoGrupoDescripcion}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-white bg-primary hover:bg-primary-700 rounded px-3 py-1 text-xs disabled:opacity-50"
              disabled={!grupoId}
              onClick={agregar}
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
