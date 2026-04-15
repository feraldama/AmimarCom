import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/useAuth";
import { getEstadoAperturaPorUsuario } from "../../../services/registrodiariocaja.service";
import { getCajaById, updateCajaMonto } from "../../../services/cajas.service";
import {
  getNominaById,
  createNomina,
  getAllNominasSinPaginacion,
} from "../../../services/nomina.service";
import { getColegioById } from "../../../services/colegio.service";
import { getColegioCursos } from "../../../services/colegio.service";
import { createColegioCobranza } from "../../../services/colegiocobranza.service";
import { getCajaGastosByTipoGastoAndGrupo } from "../../../services/cajagasto.service";
import { createRegistroDiarioCaja } from "../../../services/registros.service";
import NominaModal from "../../../components/common/NominaModal";
import Swal from "sweetalert2";
import { formatMiles, formatMilesWithDecimals } from "../../../utils/utils";

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  [key: string]: unknown;
}

interface Nomina {
  NominaId: number;
  NominaNombre: string;
  NominaApellido: string;
  ColegioId: number;
  ColegioCursoId: number;
}

interface ColegioCurso {
  ColegioId: number;
  ColegioCursoId: number;
  ColegioCursoNombre: string;
  ColegioCursoImporte: string;
}

export default function CobranzaColegiosTab() {
  const { user } = useAuth();
  const [cajaAperturada, setCajaAperturada] = useState<Caja | null>(null);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [showNominaModal, setShowNominaModal] = useState(false);
  const [nominaSeleccionada, setNominaSeleccionada] = useState<Nomina | null>(
    null
  );

  // Formulario
  const [cajaId, setCajaId] = useState<string | number>("");
  const [fecha, setFecha] = useState("");
  const [nominaId, setNominaId] = useState<string | number>("");
  const [colegioId, setColegioId] = useState<number | "">("");
  const [colegioNombre, setColegioNombre] = useState("");
  const [cursoId, setCursoId] = useState<number | "">("");
  const [cursoNombre, setCursoNombre] = useState("");
  const [importe, setImporte] = useState<number>(0);
  const [mesPagado, setMesPagado] = useState("");
  const [mes, setMes] = useState<number>(0);
  const [subtotalCuota, setSubtotalCuota] = useState<number>(0);
  const [diasMora, setDiasMora] = useState<number>(0);
  const [multa, setMulta] = useState<number>(0);
  const [examen, setExamen] = useState<number | "">("");
  const [descuento, setDescuento] = useState<number | "">("");
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      try {
        // Obtener caja aperturada
        const estado = await getEstadoAperturaPorUsuario(user.id);
        if (estado.cajaId && estado.aperturaId > estado.cierreId) {
          const caja = await getCajaById(estado.cajaId);
          setCajaAperturada(caja);
          setCajaId(estado.cajaId);
        } else {
          setCajaAperturada(null);
        }

        // Obtener todas las nominas sin paginación
        const nominasData = await getAllNominasSinPaginacion();
        setNominas(nominasData.data || []);

        // Inicializar fecha actual
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hh = String(hoy.getHours()).padStart(2, "0");
        const min = String(hoy.getMinutes()).padStart(2, "0");
        setFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      }
    };
    fetchData();
  }, [user]);

  // Cuando se selecciona una nómina, cargar colegio y curso
  useEffect(() => {
    const loadNominaData = async () => {
      if (!nominaId) {
        setColegioId("");
        setColegioNombre("");
        setCursoId("");
        setCursoNombre("");
        setImporte(0);
        return;
      }

      try {
        const nomina = await getNominaById(nominaId);
        if (nomina) {
          setColegioId(nomina.ColegioId);
          setCursoId(nomina.ColegioCursoId);

          // Cargar nombre del colegio
          const colegio = await getColegioById(nomina.ColegioId);
          setColegioNombre(colegio?.ColegioNombre || "");

          // Cargar curso y su importe
          const cursos = await getColegioCursos(nomina.ColegioId);
          const curso = cursos.find(
            (c: ColegioCurso) => c.ColegioCursoId === nomina.ColegioCursoId
          );
          if (curso) {
            setCursoNombre(curso.ColegioCursoNombre);
            const importeValue = Number(curso.ColegioCursoImporte) || 0;
            setImporte(importeValue);
            // Resetear multa cuando cambia el curso
            setMulta(0);
            setDiasMora(0);
          }
        }
      } catch (error) {
        console.error("Error al cargar datos de la nómina:", error);
      }
    };

    loadNominaData();
  }, [nominaId]);

  // Calcular subtotal cuando cambian importe o mes
  useEffect(() => {
    const nuevoSubtotal = importe * mes;
    setSubtotalCuota(nuevoSubtotal);
  }, [importe, mes]);

  // Calcular multa cuando cambian días de mora
  useEffect(() => {
    const nuevaMulta = diasMora * 1000;
    setMulta(nuevaMulta);
  }, [diasMora]);

  // Calcular total cuando cambian los valores
  useEffect(() => {
    const examenValue = Number(examen) || 0;
    const descuentoValue = Number(descuento) || 0;
    const multaValue = Number(multa) || 0;
    const nuevoTotal =
      subtotalCuota + multaValue + examenValue - descuentoValue;
    setTotal(Math.max(0, nuevoTotal));
  }, [subtotalCuota, multa, examen, descuento]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAperturada || !user) {
      Swal.fire({
        icon: "warning",
        title: "Caja no aperturada",
        text: "Debes aperturar una caja antes de realizar cobranzas.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    if (!nominaId || !colegioId || !cursoId) {
      Swal.fire({
        icon: "warning",
        title: "Datos incompletos",
        text: "Debes seleccionar una nómina válida.",
        confirmButtonColor: "#2563eb",
      });
      return;
    }

    try {
      // Obtener el colegio para saber su TipoGastoId y TipoGastoGrupoId
      const colegio = await getColegioById(colegioId);
      if (!colegio || !colegio.TipoGastoId || !colegio.TipoGastoGrupoId) {
        Swal.fire({
          icon: "warning",
          title: "Error",
          text: "El colegio no tiene TipoGastoId y TipoGastoGrupoId asignados.",
          confirmButtonColor: "#2563eb",
        });
        return;
      }

      // Obtener todas las cajas que tengan este TipoGastoId y TipoGastoGrupoId asignado
      const todasLasCajasConGasto = await getCajaGastosByTipoGastoAndGrupo(
        colegio.TipoGastoId,
        colegio.TipoGastoGrupoId
      );

      // Crear la cobranza primero para obtener su ID
      const cobranzaResponse = await createColegioCobranza({
        CajaId: cajaId,
        ColegioCobranzaFecha: fecha,
        NominaId: nominaId,
        ColegioCobranzaMesPagado: mesPagado,
        ColegioCobranzaMes: mes,
        ColegioCobranzaDiasMora: diasMora,
        ColegioCobranzaExamen: examen || 0,
        UsuarioId: user.id,
        ColegioCobranzaDescuento: descuento || 0,
      });

      // Obtener el ID de la cobranza creada
      const colegioCobranzaId =
        cobranzaResponse.data?.ColegioCobranzaId ||
        cobranzaResponse.ColegioCobranzaId;

      // Crear registro diario de caja con NominaId y ColegioCobranzaId en el detalle
      const detalleRegistro = `Cobranza Colegio: ${colegioNombre} - Nómina: ${
        nominaSeleccionada?.NominaApellido || ""
      }, ${
        nominaSeleccionada?.NominaNombre || ""
      } | NominaId:${nominaId} ColegioCobranzaId:${colegioCobranzaId}`;

      await createRegistroDiarioCaja({
        CajaId: cajaId,
        RegistroDiarioCajaFecha: fecha,
        TipoGastoId: colegio.TipoGastoId,
        TipoGastoGrupoId: colegio.TipoGastoGrupoId,
        RegistroDiarioCajaDetalle: detalleRegistro,
        RegistroDiarioCajaMonto: total,
        UsuarioId: user.id,
        RegistroDiarioCajaCambio: 0,
        RegistroDiarioCajaMTCN: 0,
        RegistroDiarioCajaCargoEnvio: 0,
      });

      // Obtener IDs únicos de todas las cajas que tienen el gasto asignado
      const cajasIdsConGasto = new Set<number>();
      todasLasCajasConGasto.forEach((cajaGasto: { CajaId: number }) => {
        cajasIdsConGasto.add(Number(cajaGasto.CajaId));
      });

      const totalNumero = Number(total);
      const cajaIdNumero = Number(cajaId);

      // Actualizar la caja aperturada: SUMAR el total
      const cajaAperturadaActual = await getCajaById(cajaIdNumero);
      const cajaAperturadaMontoActual = Number(cajaAperturadaActual.CajaMonto);
      await updateCajaMonto(
        cajaIdNumero,
        cajaAperturadaMontoActual + totalNumero
      );

      // Actualizar las demás cajas que tienen el gasto asignado: RESTAR el total
      // (excluyendo la caja aperturada si está en la lista)
      const cajasParaRestar = Array.from(cajasIdsConGasto).filter(
        (id) => id !== cajaIdNumero
      );

      if (cajasParaRestar.length > 0) {
        const actualizaciones = cajasParaRestar.map(
          async (cajaIdParaActualizar: number) => {
            const cajaActual = await getCajaById(cajaIdParaActualizar);
            const cajaMontoActual = Number(cajaActual.CajaMonto);
            // Restar el total (es un gasto para estas cajas)
            await updateCajaMonto(
              cajaIdParaActualizar,
              cajaMontoActual - totalNumero
            );
          }
        );

        await Promise.all(actualizaciones);
      }

      Swal.fire(
        "Cobranza registrada",
        "La cobranza fue registrada correctamente",
        "success"
      );

      // Limpiar formulario
      handleCancel();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "No se pudo registrar la cobranza";
      Swal.fire("Error", errorMsg, "error");
    }
  };

  const handleCancel = () => {
    setNominaId("");
    setNominaSeleccionada(null);
    setColegioId("");
    setColegioNombre("");
    setCursoId("");
    setCursoNombre("");
    setImporte(0);
    setMesPagado("");
    setMes(0);
    setSubtotalCuota(0);
    setDiasMora(0);
    setMulta(0);
    setExamen("");
    setDescuento("");
    setTotal(0);
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const hh = String(hoy.getHours()).padStart(2, "0");
    const min = String(hoy.getMinutes()).padStart(2, "0");
    setFecha(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-success-700 mb-6 border-b-2 border-green-500 pb-2">
          COLEGIO COBRANZA
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Nómina */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nómina
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNominaModal(true);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-left bg-white hover:bg-gray-50 transition"
              >
                {nominaSeleccionada
                  ? `${nominaSeleccionada.NominaApellido}, ${nominaSeleccionada.NominaNombre}`
                  : "Seleccione una nómina..."}
              </button>
            </div>

            {/* Colegio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Colegio
              </label>
              <input
                type="text"
                value={colegioNombre}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Curso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Curso
              </label>
              <input
                type="text"
                value={cursoNombre}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Importe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importe
              </label>
              <input
                type="text"
                value={importe > 0 ? formatMilesWithDecimals(importe) : "0,00"}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Mes Pagado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mes Pagado
              </label>
              <input
                type="text"
                value={mesPagado}
                onChange={(e) => setMesPagado(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            {/* Mes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mes
              </label>
              <input
                type="number"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value) || 0)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Subtotal Cuota */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subtotal Cuota
              </label>
              <input
                type="text"
                value={
                  subtotalCuota > 0
                    ? formatMilesWithDecimals(subtotalCuota)
                    : "0,00"
                }
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Dias Mora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dias Mora
              </label>
              <input
                type="number"
                value={diasMora}
                onChange={(e) => {
                  const dias = Number(e.target.value) || 0;
                  setDiasMora(dias);
                }}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Multa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multa
              </label>
              <input
                type="text"
                value={multa > 0 ? formatMilesWithDecimals(multa) : "0,00"}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

            {/* Examen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Examen
              </label>
              <input
                type="text"
                value={examen !== "" ? formatMiles(examen) : ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/,/g, ".");
                  const num = Number(raw);
                  setExamen(isNaN(num) ? "" : num);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                inputMode="numeric"
              />
            </div>

            {/* Descuento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento
              </label>
              <input
                type="text"
                value={descuento !== "" ? formatMiles(descuento) : ""}
                onChange={(e) => {
                  const raw = e.target.value
                    .replace(/\./g, "")
                    .replace(/,/g, ".");
                  const num = Number(raw);
                  setDescuento(isNaN(num) ? "" : num);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                inputMode="numeric"
              />
            </div>

            {/* Total */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total
              </label>
              <input
                type="text"
                value={total > 0 ? formatMilesWithDecimals(total) : "0,00"}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-bold"
              />
            </div>

            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={user?.id || ""}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 transition font-medium"
            >
              CONFIRMAR
            </button>
          </div>
        </form>
      </div>
      <NominaModal
        show={showNominaModal}
        onClose={() => setShowNominaModal(false)}
        nominas={nominas}
        onSelect={(nomina) => {
          setNominaSeleccionada(nomina);
          setNominaId(nomina.NominaId);
          setShowNominaModal(false);
        }}
        onCreateNomina={async (nominaData) => {
          try {
            // Validar que los campos requeridos estén presentes
            if (
              !nominaData.NominaNombre ||
              !nominaData.ColegioId ||
              nominaData.ColegioId === 0 ||
              !nominaData.ColegioCursoId ||
              nominaData.ColegioCursoId === 0
            ) {
              Swal.fire({
                icon: "warning",
                title: "Datos incompletos",
                text: "Debe completar todos los campos requeridos (Nombre, Colegio y Curso)",
              });
              throw new Error("Datos incompletos");
            }

            // Crear la nómina directamente como en NominasPage
            const response = await createNomina({
              NominaNombre: nominaData.NominaNombre,
              NominaApellido: nominaData.NominaApellido || "",
              ColegioId: Number(nominaData.ColegioId),
              ColegioCursoId: Number(nominaData.ColegioCursoId),
            });

            // Recargar la lista de nóminas
            const nominasResponse = await getAllNominasSinPaginacion();
            setNominas(nominasResponse.data || []);

            // Si la respuesta tiene data, usar esa, sino buscar por el ID retornado
            if (response.data) {
              setNominaSeleccionada(response.data as unknown as Nomina);
              setNominaId((response.data as Nomina).NominaId);
              setShowNominaModal(false);
              Swal.fire({
                icon: "success",
                title: "Nómina creada exitosamente",
                text: "La nómina ha sido creada y seleccionada",
              });
            } else {
              // Si no viene en data, buscar en la lista actualizada
              const nuevaNominaEnLista = nominasResponse.data?.find(
                (n: Nomina) =>
                  n.NominaNombre === nominaData.NominaNombre &&
                  n.ColegioId === Number(nominaData.ColegioId)
              );
              if (nuevaNominaEnLista) {
                setNominaSeleccionada(nuevaNominaEnLista);
                setNominaId(nuevaNominaEnLista.NominaId);
                setShowNominaModal(false);
                Swal.fire({
                  icon: "success",
                  title: "Nómina creada exitosamente",
                  text: "La nómina ha sido creada y seleccionada",
                });
              } else {
                throw new Error("No se pudo encontrar la nómina creada");
              }
            }
          } catch (error) {
            console.error("Error al crear nómina:", error);
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Hubo un problema al crear la nómina";
            Swal.fire({
              icon: "error",
              title: "Error al crear nómina",
              text: errorMessage,
            });
            throw error; // Re-lanzar el error para que el modal lo maneje
          }
        }}
      />
    </div>
  );
}
