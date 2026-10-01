import { LockOpen, CalendarCheck } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getCajas } from "../../services/cajas.service";
import ActionButton from "../../components/common/Button/ActionButton";
import {
  aperturaCierreCaja,
  getEstadoAperturaPorUsuario,
  getUltimoCierrePorCaja,
  getSaldoCajaAbierta,
  getTurnoCierre,
  type SaldoCajaAbierta,
} from "../../services/registrodiariocaja.service";
import { createCierreDiarioSnapshot } from "../../services/cierrediario.service";
import { useAuth } from "../../contexts/useAuth";
import Swal from "sweetalert2";
import { formatMiles } from "../../utils/utils";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import PageHeader from "../../components/common/PageHeader";
import { usePermiso } from "../../hooks/usePermiso";


const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000];
const MONEDAS = [1000, 500, 100, 50];

interface Caja {
  id: string | number;
  CajaId: string | number;
  CajaDescripcion: string;
  CajaMonto: number;
  CajaTipoId?: number | null;
}

interface RegistroDiarioCaja {
  RegistroDiarioCajaId: number;
  CajaId: number;
  UsuarioId: string;
  RegistroDiarioCajaFecha: string;
  RegistroDiarioCajaMonto: number;
  TipoGastoId: number;
  TipoGastoGrupoId: number;
  TipoGastoDescripcion?: string;
  TipoGastoGrupoDescripcion?: string;
  RegistroDiarioCajaDetalle?: string;
  RegistroDiarioCajaCambio?: number;
}

interface Pendiente {
  monto: number;
  detalle: string;
}

export default function AperturaCierreCajaPage() {
  const [tipo, setTipo] = useState<"0" | "1">("0");
  const [tipoDisabled, setTipoDisabled] = useState(false);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [cajaId, setCajaId] = useState<string | number>("");
  const [cantidadesBilletes, setCantidadesBilletes] = useState<
    Record<number, number>
  >(() =>
    BILLETES.reduce(
      (acc, d) => ({ ...acc, [d]: 0 }),
      {} as Record<number, number>,
    ),
  );
  const [cantidadesMonedas, setCantidadesMonedas] = useState<
    Record<number, number>
  >(() =>
    MONEDAS.reduce(
      (acc, d) => ({ ...acc, [d]: 0 }),
      {} as Record<number, number>,
    ),
  );
  const [pendientes, setPendientes] = useState<Pendiente[]>([
    { monto: 0, detalle: "" },
    { monto: 0, detalle: "" },
    { monto: 0, detalle: "" },
    { monto: 0, detalle: "" },
  ]);
  const [montoApertura, setMontoApertura] = useState<number>(0);
  // Fecha del último cierre de la caja seleccionada (null = nunca cerró,
  // en cuyo caso la apertura usa el monto fijo de la caja)
  const [fechaUltimoCierre, setFechaUltimoCierre] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cajaDisabled, setCajaDisabled] = useState(false);
  const [descargarPDF, setDescargarPDF] = useState(false);
  const [operacionCompletada, setOperacionCompletada] = useState(false);
  const [todasLasCajas, setTodasLasCajas] = useState<Caja[]>([]);
  const [snapshotting, setSnapshotting] = useState(false);
  const puedeCrearCierreDiario = usePermiso("CIERREDIARIO", "crear");
  // Saldo teórico de la caja abierta (cierre): contra él se calcula en vivo el
  // sobrante/faltante a medida que se cargan billetes, monedas y pendientes.
  const [saldo, setSaldo] = useState<SaldoCajaAbierta | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);

  const subtotalesBilletes = useMemo(
    () =>
      BILLETES.map((d) => ({
        denominacion: d,
        cantidad: cantidadesBilletes[d] ?? 0,
        subtotal: (cantidadesBilletes[d] ?? 0) * d,
      })),
    [cantidadesBilletes],
  );

  const subtotalesMonedas = useMemo(
    () =>
      MONEDAS.map((d) => ({
        denominacion: d,
        cantidad: cantidadesMonedas[d] ?? 0,
        subtotal: (cantidadesMonedas[d] ?? 0) * d,
      })),
    [cantidadesMonedas],
  );

  const montoTotal = useMemo(() => {
    const sb = subtotalesBilletes.reduce((s, x) => s + x.subtotal, 0);
    const sm = subtotalesMonedas.reduce((s, x) => s + x.subtotal, 0);
    const sp = pendientes.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    return sb + sm + sp;
  }, [subtotalesBilletes, subtotalesMonedas, pendientes]);

  // Monto a rendir: el saldo teórico en valor absoluto (un teórico negativo
  // también es lo que la caja tiene que rendir). Diferencia = a rendir -
  // contado (incluye pendientes): positivo = falta cargar, negativo = sobra.
  const aRendir = saldo ? Math.abs(saldo.saldoTeorico) : 0;
  const diferencia = saldo ? aRendir - montoTotal : null;

  const cargarSaldo = useCallback(async () => {
    setCargandoSaldo(true);
    try {
      setSaldo(await getSaldoCajaAbierta());
    } catch {
      setSaldo(null);
    } finally {
      setCargandoSaldo(false);
    }
  }, []);

  // Solo con una caja abierta (cierre forzado). Se refresca al volver a la
  // pestaña por si entraron movimientos mientras se contaba el efectivo.
  const cierrePendiente = tipo === "1" && tipoDisabled && !operacionCompletada;
  useEffect(() => {
    if (!cierrePendiente) return;
    cargarSaldo();
    window.addEventListener("focus", cargarSaldo);
    return () => window.removeEventListener("focus", cargarSaldo);
  }, [cierrePendiente, cargarSaldo]);

  useEffect(() => {
    const fetchCajas = async () => {
      try {
        setLoading(true);
        const data = await getCajas(1, 1000);
        setTodasLasCajas(data.data);
        const cajasFiltradas = data.data.filter(
          (caja: Caja) => caja.CajaTipoId === 1,
        );
        setCajas(cajasFiltradas);
        if (cajasFiltradas.length > 0) setCajaId(cajasFiltradas[0].CajaId);
      } catch {
        setError("Error al cargar cajas");
      } finally {
        setLoading(false);
      }
    };
    fetchCajas();
  }, []);

  // Monto de apertura = monto del último cierre de la caja (lo que realmente
  // quedó en el cajón, incluido el sobrante/faltante del arqueo). Si la caja
  // nunca se cerró, se usa el CajaMonto como valor inicial. El backend aplica
  // la misma regla al confirmar.
  useEffect(() => {
    if (tipo !== "0" || !cajaId || todasLasCajas.length === 0) return;
    let cancelado = false;
    const cargarMontoApertura = async () => {
      const caja = todasLasCajas.find((c) => c.CajaId == cajaId);
      const montoFijo = caja != null ? Number(caja.CajaMonto) || 0 : 0;
      try {
        const { cierre } = await getUltimoCierrePorCaja(cajaId);
        if (cancelado) return;
        setMontoApertura(cierre ? cierre.monto : montoFijo);
        setFechaUltimoCierre(cierre ? cierre.fecha : null);
      } catch {
        if (cancelado) return;
        setMontoApertura(montoFijo);
        setFechaUltimoCierre(null);
      }
    };
    cargarMontoApertura();
    return () => {
      cancelado = true;
    };
  }, [tipo, cajaId, todasLasCajas]);

  useEffect(() => {
    const checkCajaAperturada = async () => {
      if (!user || todasLasCajas.length === 0) return;
      try {
        const data = await getEstadoAperturaPorUsuario(user.id);
        if (data.aperturaId > data.cierreId) {
          setTipo("1");
          setTipoDisabled(true);
          setCajaDisabled(true);
          if (data.cajaId) {
            setCajaId(data.cajaId);
            const cajaAbierta = todasLasCajas.find(
              (c) => c.CajaId == data.cajaId,
            );
            if (cajaAbierta) {
              setCajas((prevCajas) => {
                const existeEnLista = prevCajas.some(
                  (c) => c.CajaId == data.cajaId,
                );
                if (!existeEnLista) return [cajaAbierta];
                return prevCajas;
              });
            }
          }
        } else {
          setTipo("0");
          setTipoDisabled(true);
          setCajaDisabled(false);
          const cajasFiltradas = todasLasCajas.filter(
            (caja: Caja) => caja.CajaTipoId === 1,
          );
          setCajas(cajasFiltradas);
          if (cajasFiltradas.length > 0) setCajaId(cajasFiltradas[0].CajaId);
        }
      } catch {
        // Si hay error, no forzar nada
      }
    };
    checkCajaAperturada();
  }, [user, location.pathname, todasLasCajas]);

  useEffect(() => {
    if (error) {
      Swal.fire({
        icon: "warning",
        title: "Aviso",
        text: error,
        confirmButtonColor: "#0d9488",
      });
      setError(null);
    }
  }, [error]);

  const generarResumenCierrePDF = async (
    datosCierre?: {
      billetes: { denominacion: number; cantidad: number; subtotal: number }[];
      monedas: { denominacion: number; cantidad: number; subtotal: number }[];
      pendientes: Pendiente[];
    },
  ) => {
    if (!user || !cajaId) return;

    // El backend devuelve el último turno cerrado del usuario en la caja:
    // apertura, cierre y todos los registros de la caja entre ambos (sin
    // filtrar usuario, así entran los PASE recibidos desde otras cajas).
    let registrosFiltrados: RegistroDiarioCaja[];
    let aperturaReg: RegistroDiarioCaja | undefined;
    let cierreReg: RegistroDiarioCaja | undefined;
    try {
      const turno = await getTurnoCierre<RegistroDiarioCaja>(cajaId);
      registrosFiltrados = turno.registros;
      aperturaReg = registrosFiltrados.find(
        (r) => r.RegistroDiarioCajaId === turno.aperturaId,
      );
      cierreReg = registrosFiltrados.find(
        (r) => r.RegistroDiarioCajaId === turno.cierreId,
      );
    } catch (err) {
      Swal.fire({
        icon: "warning",
        title: "Error al cargar registros",
        text:
          (err as { message?: string })?.message ||
          "No se pudieron cargar los registros de caja.",
        confirmButtonColor: "#0d9488",
      });
      return;
    }
    if (!aperturaReg || !cierreReg) return;

    const cajaDescripcion =
      cajas.find((c) => c.CajaId == cajaId)?.CajaDescripcion || "";
    const fecha = new Date().toLocaleDateString();
    const hora = new Date().toLocaleTimeString();

    const apertura = Number(aperturaReg.RegistroDiarioCajaMonto);
    const cierre = Number(cierreReg.RegistroDiarioCajaMonto);
    let egresos = 0;
    let ingresos = 0;
    for (const reg of registrosFiltrados) {
      const monto = Number(reg.RegistroDiarioCajaMonto);
      if (reg.TipoGastoId === 2 && reg.TipoGastoGrupoId !== 2)
        ingresos += monto;
      if (reg.TipoGastoId === 1 && reg.TipoGastoGrupoId !== 2) egresos += monto;
    }
    // El monto de cierre ya incluye los pendientes (efectivo + pendientes).
    // Los pendientes son plata que salió/se debe, así que forman parte de lo que
    // la caja debe rendir y se comparan contra el teórico igual que el efectivo.
    // Por eso NO se descuentan acá: un pendiente correctamente cargado NO genera
    // faltante ni sobrante.
    const sobranteFaltante = ingresos + apertura - (cierre + egresos);
    let txtSobranteFaltante = "";
    if (sobranteFaltante > 0) {
      txtSobranteFaltante = `Faltante de: ${formatMiles(sobranteFaltante)}`;
    } else if (sobranteFaltante < 0) {
      txtSobranteFaltante = `Sobrante de: ${formatMiles(Math.abs(sobranteFaltante))}`;
    } else {
      txtSobranteFaltante = "Sobrante/Faltante: 0";
    }
    // Totales del encabezado: ingresos incluye la apertura, egresos no incluye
    // el cierre, y la diferencia es el saldo teórico (apertura + ingresos - egresos).
    const totalIngresos = ingresos + apertura;
    const diferencia = totalIngresos - egresos;

    // Desglose de egresos e ingresos por concepto (grupo de gasto), sumando los
    // montos de cada grupo y acumulando el equivalente en U$D cuando hay cotización.
    const agruparMovimientos = (
      filtro: (reg: RegistroDiarioCaja) => boolean,
    ) => {
      const mapa = new Map<
        string,
        { label: string; monto: number; usd: number }
      >();
      registrosFiltrados
        .filter(filtro)
        .slice()
        .sort((a, b) => a.RegistroDiarioCajaId - b.RegistroDiarioCajaId)
        .forEach((reg) => {
          const label =
            (reg.TipoGastoGrupoDescripcion || "").trim() ||
            (reg.TipoGastoDescripcion || "").trim() ||
            (reg.RegistroDiarioCajaDetalle || "").trim() ||
            "OTROS";
          const monto = Number(reg.RegistroDiarioCajaMonto) || 0;
          const cambio = Number(reg.RegistroDiarioCajaCambio) || 0;
          const usd = cambio > 0 ? monto / cambio : 0;
          const actual = mapa.get(label) || { label, monto: 0, usd: 0 };
          actual.monto += monto;
          actual.usd += usd;
          mapa.set(label, actual);
        });
      return Array.from(mapa.values());
    };

    const egresosAgrupados = agruparMovimientos(
      (reg) => reg.TipoGastoId === 1 && reg.TipoGastoGrupoId !== 2,
    );
    const ingresosAgrupados = agruparMovimientos(
      (reg) => reg.TipoGastoId === 2 && reg.TipoGastoGrupoId !== 2,
    );
    // El cierre de caja no se cuenta como egreso en el ticket; el total de
    // egresos sólo suma los movimientos de egreso reales.
    const totalEgresosSeccion = egresos;
    const totalIngresosSeccion = apertura + ingresos;

    const billetesTicket =
      datosCierre?.billetes ??
      BILLETES.map((d) => ({ denominacion: d, cantidad: 0, subtotal: 0 }));
    const monedasTicket =
      datosCierre?.monedas ??
      MONEDAS.map((d) => ({ denominacion: d, cantidad: 0, subtotal: 0 }));
    const pendientesTicket = datosCierre?.pendientes ?? [];
    const totalEfectivo =
      billetesTicket.reduce((s, x) => s + x.subtotal, 0) +
      monedasTicket.reduce((s, x) => s + x.subtotal, 0);
    const totalPendientes = pendientesTicket.reduce(
      (s, p) => s + (p.monto || 0),
      0,
    );

    const pendientesConContenido = pendientesTicket.filter(
      (p) => p.monto > 0 || (p.detalle && p.detalle.trim()),
    );
    const lineasPendientes = pendientesConContenido.length || 1;

    const ALTURA_MINIMA = 0;
    const MARGEN_INFERIOR = 10;
    const calcularAlturaTicket = () => {
      let h = 10;
      h += 6 + 6;
      h += 5 * 3 + 5;
      h += 5 * 2 + 5 + 5;
      h += 5 * 3 + 5 + 5;
      h += 5 + 6 + 6 + 6;
      h += 5 + billetesTicket.length * 4 + 5;
      h += 5 + monedasTicket.length * 4 + 5;
      h += 6 + 6 + 6;
      h += 5 + lineasPendientes * 4 + 4 + 4 + 6 + 6 + 6;
      // EGRESOS: header + línea + CIERRE CAJA + grupos + línea + TOTAL + líneas
      h += 5 + 5 + 5 + egresosAgrupados.length * 5 + 5 + 6 + 6 + 6;
      // INGRESOS: header + línea + APERTURA CAJA + grupos + línea + TOTAL
      h += 5 + 5 + 5 + ingresosAgrupados.length * 5 + 5 + 5;
      return Math.max(ALTURA_MINIMA, h + MARGEN_INFERIOR);
    };
    const alturaPagina = calcularAlturaTicket();

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, alturaPagina],
    });
    const pageW = 80;
    const margin = 5;
    let y = 10;

    doc.setFontSize(12);
    doc.text("RESUMEN CIERRE CAJA", pageW / 2, y, { align: "center" });
    y += 6;
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.text(`Fecha: ${fecha} - Hora: ${hora}`, margin, y);
    y += 5;
    doc.text(`Usuario: ${user.nombre}`, margin, y);
    y += 5;
    doc.text(`Caja: ${cajaDescripcion}`, margin, y);
    y += 5;
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.text(`Apertura: ${formatMiles(apertura)}`, margin, y);
    y += 5;
    doc.text(`Cierre: ${formatMiles(cierre)}`, margin, y);
    y += 5;
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.text(`Egresos: ${formatMiles(egresos)}`, margin, y);
    y += 5;
    doc.text(`Ingresos: ${formatMiles(totalIngresos)}`, margin, y);
    y += 5;
    doc.text(`Diferencia: ${formatMiles(diferencia)}`, margin, y);
    y += 5;
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.text(txtSobranteFaltante, margin, y);
    y += 6;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    doc.setLineWidth(0.1);
    y += 6;

    doc.setFontSize(9);
    doc.text("Billete: Monto - Cantidad", pageW / 2, y, { align: "center" });
    y += 5;
    billetesTicket.forEach((b) => {
      doc.text(
        `${formatMiles(b.denominacion)}: ${b.cantidad} - ${formatMiles(b.subtotal)}`,
        margin,
        y,
      );
      y += 4;
    });
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.text("Moneda: Monto - Cantidad", pageW / 2, y, { align: "center" });
    y += 5;
    monedasTicket.forEach((m) => {
      doc.text(
        `${formatMiles(m.denominacion)}: ${m.cantidad} - ${formatMiles(m.subtotal)}`,
        margin,
        y,
      );
      y += 4;
    });
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.text(`Total: ${formatMiles(totalEfectivo)}`, margin, y);
    y += 6;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    doc.setLineWidth(0.1);
    y += 6;

    doc.text("Pendientes: Monto - Detalle", pageW / 2, y, { align: "center" });
    y += 5;
    pendientesTicket.forEach((p, i) => {
      if (p.monto > 0 || (p.detalle && p.detalle.trim())) {
        doc.text(
          `${i + 1}) ${formatMiles(p.monto)} - ${(p.detalle || "").trim() || "-"}`,
          margin,
          y,
        );
        y += 4;
      }
    });
    if (
      pendientesTicket.every(
        (p) => !p.monto && !(p.detalle && p.detalle.trim()),
      )
    ) {
      y += 4;
    }
    doc.line(margin, y, pageW - margin, y);
    y += 4;
    doc.text(`Total Pendientes: ${formatMiles(totalPendientes)}`, margin, y);
    y += 6;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    doc.setLineWidth(0.1);
    y += 6;

    doc.text("EGRESOS", pageW / 2, y, { align: "center" });
    y += 5;
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    egresosAgrupados.forEach((g) => {
      const sufijoUsd =
        g.usd > 0 ? ` - U$D: ${formatMiles(Math.round(g.usd))}` : "";
      doc.text(`${g.label}: ${formatMiles(g.monto)}${sufijoUsd}`, margin, y);
      y += 5;
    });
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.text(`TOTAL EGRESOS: ${formatMiles(totalEgresosSeccion)}`, margin, y);
    y += 6;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    doc.setLineWidth(0.1);
    y += 6;

    doc.text("INGRESOS", pageW / 2, y, { align: "center" });
    y += 5;
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.text(`APERTURA CAJA: ${formatMiles(apertura)}`, margin, y);
    y += 5;
    ingresosAgrupados.forEach((g) => {
      const sufijoUsd =
        g.usd > 0 ? ` - U$D: ${formatMiles(Math.round(g.usd))}` : "";
      doc.text(`${g.label}: ${formatMiles(g.monto)}${sufijoUsd}`, margin, y);
      y += 5;
    });
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.text(`TOTAL INGRESOS: ${formatMiles(totalIngresosSeccion)}`, margin, y);

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `ResumenCierreCaja_${fecha.replace(/\//g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      const openLink = document.createElement("a");
      openLink.href = pdfUrl;
      openLink.target = "_blank";
      document.body.appendChild(openLink);
      openLink.click();
      document.body.removeChild(openLink);
    }, 500);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    setOperacionCompletada(true);
    try {
      const montoEnviar = tipo === "0" ? montoApertura : montoTotal;
      const payload: {
        apertura: 0 | 1;
        CajaId: string | number;
        Monto: number;
        RegistroDiarioCajaPendiente1?: number;
        RegistroDiarioCajaPendiente2?: number;
        RegistroDiarioCajaPendiente3?: number;
        RegistroDiarioCajaPendiente4?: number;
      } = {
        apertura: tipo === "0" ? 0 : 1,
        CajaId: cajaId,
        Monto: montoEnviar,
      };
      if (tipo === "1") {
        payload.RegistroDiarioCajaPendiente1 = pendientes[0]?.monto ?? 0;
        payload.RegistroDiarioCajaPendiente2 = pendientes[1]?.monto ?? 0;
        payload.RegistroDiarioCajaPendiente3 = pendientes[2]?.monto ?? 0;
        payload.RegistroDiarioCajaPendiente4 = pendientes[3]?.monto ?? 0;
      }
      const result = await aperturaCierreCaja(payload);
      if (tipo === "0") {
        await Swal.fire({
          icon: "success",
          title: "Apertura exitosa",
          text: result.message || "La caja se aperturó correctamente",
          confirmButtonText: "Ir a cobros",
          confirmButtonColor: "#0d9488",
        });
        navigate("/ventas");
      } else {
        setSuccess(result.message || "Operación realizada correctamente");
        setDescargarPDF(true);
        // El cierre ya quedó grabado: un error del ticket no debe caer en el
        // catch de abajo (re-habilitaría CONFIRMAR y permitiría cerrar dos veces).
        // Queda el botón "Descargar Resumen PDF" para reintentar.
        generarResumenCierrePDF({
          billetes: subtotalesBilletes,
          monedas: subtotalesMonedas,
          pendientes,
        }).catch((err) => console.error("Error al generar el ticket:", err));
      }
    } catch (err) {
      setError(
        (err as { message?: string })?.message || "Error en la operación",
      );
      setOperacionCompletada(false);
    } finally {
      setSubmitting(false);
    }
  };

  const setCantidadBillete = (denominacion: number, cantidad: number) => {
    setCantidadesBilletes((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, cantidad),
    }));
  };

  const setCantidadMoneda = (denominacion: number, cantidad: number) => {
    setCantidadesMonedas((prev) => ({
      ...prev,
      [denominacion]: Math.max(0, cantidad),
    }));
  };

  const setPendiente = (
    index: number,
    field: "monto" | "detalle",
    value: number | string,
  ) => {
    setPendientes((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = { monto: 0, detalle: "" };
      if (field === "monto") next[index].monto = Math.max(0, value as number);
      else next[index].detalle = String(value);
      return next;
    });
  };

  const handleCierreDiarioSnapshot = async () => {
    const confirm = await Swal.fire({
      title: "¿Registrar Cierre Diario?",
      html:
        "Esto va a guardar el saldo actual de <b>todas las cajas</b> en el historial " +
        `del día de hoy (${new Date().toLocaleDateString()}).<br><br>` +
        "Solo se puede hacer una vez por día.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#0d9488",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, registrar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;

    setSnapshotting(true);
    try {
      const result = await createCierreDiarioSnapshot();
      Swal.fire({
        icon: "success",
        title: "Cierre diario registrado",
        text: result.message,
        confirmButtonColor: "#0d9488",
      });
    } catch (err) {
      const e = err as { message?: string };
      Swal.fire({
        icon: "warning",
        title: "No se pudo registrar",
        text: e?.message || "Error desconocido",
        confirmButtonColor: "#0d9488",
      });
    } finally {
      setSnapshotting(false);
    }
  };

  const parseMontoInput = (raw: string): number => {
    const normalized = raw
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/\s/g, "");
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  };

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Apertura / Cierre de Caja"
        icon={LockOpen}
      />
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-100 text-danger-600 rounded-lg">
          Error: {error}
        </div>
      )}
      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
      {user && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-gray-700">
          <span className="font-semibold">Usuario:</span> {user.nombre} (
          {user.id})
          {tipoDisabled && cajaId && (
            <span className="ml-2 text-sm text-gray-600">
              | Caja:{" "}
              {cajas.find((c) => c.CajaId == cajaId)?.CajaDescripcion || ""}
            </span>
          )}
        </div>
      )}

      {puedeCrearCierreDiario && (
        <div className="mb-4 p-4 bg-primary-50 border border-primary-100 rounded-lg flex items-start gap-3">
          <CalendarCheck className="size-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">
              Cierre Diario Gerencial
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Registra un snapshot del saldo actual de todas las cajas en el
              historial. Hacer una vez al final del día.
            </p>
          </div>
          <ActionButton
            label={snapshotting ? "Registrando..." : "Registrar Cierre Diario"}
            onClick={handleCierreDiarioSnapshot}
            disabled={snapshotting}
            icon={CalendarCheck}
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow p-6 space-y-6"
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900">
              Tipo de operación
            </label>
            <select
              className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5 ${
                tipoDisabled ? "bg-gray-200 text-gray-500" : ""
              }`}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "0" | "1")}
              required
              disabled={tipoDisabled}
            >
              <option value="0">Apertura</option>
              <option value="1">Cierre</option>
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-900">
              Caja
            </label>
            <select
              className={`bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5 ${
                cajaDisabled ? "bg-gray-200 text-gray-500" : ""
              }`}
              value={cajaId}
              onChange={(e) => setCajaId(e.target.value)}
              required
              disabled={cajaDisabled}
            >
              {cajas.map((caja) => (
                <option key={caja.CajaId} value={caja.CajaId}>
                  {caja.CajaDescripcion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Apertura: monto de apertura = CajaMonto de la caja (solo lectura) */}
        {tipo === "0" && (
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Monto de apertura
            </label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="bg-gray-100 border border-gray-200 text-gray-900 text-sm rounded-lg block w-full p-2.5 pointer-events-none"
              value={montoApertura ? formatMiles(montoApertura) : ""}
            />
            <p className="mt-1 text-xs text-gray-500">
              {fechaUltimoCierre
                ? `Corresponde al monto contado en el último cierre (${new Date(
                    fechaUltimoCierre,
                  ).toLocaleString("es-PY", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}), incluido el sobrante o faltante de ese arqueo.`
                : "La caja no tiene cierres previos: corresponde al monto fijo de la caja seleccionada."}
            </p>
          </div>
        )}

        {/* Cierre: Billetes, Monedas, Pendientes y total */}
        {tipo === "1" && (
          <>
            {/* Saldo teórico de la caja (lo que debería haber en el cajón) */}
            {cierrePendiente && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Saldo teórico de la caja
                  </h3>
                  <button
                    type="button"
                    onClick={cargarSaldo}
                    disabled={cargandoSaldo}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {cargandoSaldo ? "Actualizando..." : "Actualizar"}
                  </button>
                </div>
                {saldo ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-gray-600">Apertura</dt>
                    <dd className="text-right">{formatMiles(saldo.apertura)}</dd>
                    <dt className="text-gray-600">+ Ingresos</dt>
                    <dd className="text-right">{formatMiles(saldo.ingresos)}</dd>
                    <dt className="text-gray-600">− Egresos</dt>
                    <dd className="text-right">{formatMiles(saldo.egresos)}</dd>
                    <dt className="font-semibold text-gray-900 border-t border-gray-200 pt-1">
                      Saldo teórico
                    </dt>
                    <dd className="text-right font-semibold text-gray-900 border-t border-gray-200 pt-1">
                      Gs. {formatMiles(saldo.saldoTeorico)}
                    </dd>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">
                    {cargandoSaldo
                      ? "Calculando..."
                      : "No se pudo obtener el saldo de la caja."}
                  </p>
                )}
              </div>
            )}

            {/* Billetes */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Billetes
              </h3>
              <div className="space-y-2">
                {subtotalesBilletes.map(
                  ({ denominacion, cantidad, subtotal }) => (
                    <div
                      key={denominacion}
                      className="flex items-center gap-4 flex-wrap"
                    >
                      <span className="w-20 text-sm text-gray-700">
                        {formatMiles(denominacion)}
                      </span>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        className="w-24 text-right bg-gray-100 border border-gray-200 text-sm rounded px-2 py-1.5 pointer-events-none"
                        value={formatMiles(subtotal)}
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-20 text-right border border-gray-300 text-sm rounded px-2 py-1.5 focus:ring-green-500 focus:border-green-500"
                        value={cantidad || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCantidadBillete(
                            denominacion,
                            v === "" ? 0 : parseInt(v, 10) || 0,
                          );
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Monedas */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Monedas
              </h3>
              <div className="space-y-2">
                {subtotalesMonedas.map(
                  ({ denominacion, cantidad, subtotal }) => (
                    <div
                      key={denominacion}
                      className="flex items-center gap-4 flex-wrap"
                    >
                      <span className="w-20 text-sm text-gray-700">
                        {formatMiles(denominacion)}
                      </span>
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        className="w-24 text-right bg-gray-100 border border-gray-200 text-sm rounded px-2 py-1.5 pointer-events-none"
                        value={formatMiles(subtotal)}
                      />
                      <input
                        type="number"
                        min={0}
                        className="w-20 text-right border border-gray-300 text-sm rounded px-2 py-1.5 focus:ring-green-500 focus:border-green-500"
                        value={cantidad || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCantidadMoneda(
                            denominacion,
                            v === "" ? 0 : parseInt(v, 10) || 0,
                          );
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Pendientes: Monto - Detalle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Pendientes: Monto - Detalle
              </h3>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-600 w-6">{i + 1}.</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="w-28 text-right border border-gray-300 text-sm rounded px-2 py-1.5 focus:ring-green-500 focus:border-green-500"
                      value={
                        pendientes[i]?.monto
                          ? formatMiles(pendientes[i].monto)
                          : ""
                      }
                      onChange={(e) =>
                        setPendiente(
                          i,
                          "monto",
                          parseMontoInput(e.target.value),
                        )
                      }
                    />
                    <input
                      type="text"
                      placeholder="Detalle"
                      className="flex-1 min-w-[120px] border border-gray-300 text-sm rounded px-2 py-1.5 focus:ring-green-500 focus:border-green-500"
                      value={pendientes[i]?.detalle ?? ""}
                      onChange={(e) =>
                        setPendiente(i, "detalle", e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Monto total Gs. */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-800">
                Monto Gs.:
              </span>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                className="flex-1 text-right font-semibold bg-gray-100 border border-gray-200 text-gray-900 rounded-lg px-3 py-2 pointer-events-none"
                value={formatMiles(montoTotal)}
              />
            </div>

            {/* Sobrante/faltante en vivo: fijo abajo para verlo mientras se
                cargan billetes y monedas */}
            {cierrePendiente && saldo && diferencia !== null && (
              <div
                className={`sticky bottom-0 -mx-6 px-6 py-3 border-t-2 shadow-[0_-4px_8px_rgba(0,0,0,0.06)] ${
                  diferencia === 0
                    ? "bg-success-50 border-success-600"
                    : "bg-danger-50 border-danger-600"
                }`}
              >
                <div className="flex justify-between text-xs text-gray-600">
                  <span>A rendir: Gs. {formatMiles(aRendir)}</span>
                  <span>Contado: Gs. {formatMiles(montoTotal)}</span>
                </div>
                <div
                  className={`mt-1 flex justify-between items-baseline font-semibold ${
                    diferencia === 0 ? "text-success-600" : "text-danger-600"
                  }`}
                >
                  <span>
                    {diferencia > 0
                      ? "Faltante (falta cargar)"
                      : diferencia < 0
                        ? "Sobrante"
                        : "Cuadra"}
                  </span>
                  <span className="text-lg">
                    Gs. {formatMiles(Math.abs(diferencia))}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-2">
          <ActionButton
            onClick={handleSubmit}
            label="CONFIRMAR"
            disabled={submitting || operacionCompletada}
          />
        </div>
        {success && (
          <div className="text-success-600 text-center font-medium mt-2">
            {success}
          </div>
        )}
      </form>

      {success && tipo === "1" && descargarPDF && (
        <div className="flex justify-center mt-4">
          <ActionButton
            label="Descargar Resumen PDF"
            onClick={() =>
              generarResumenCierrePDF({
                billetes: subtotalesBilletes,
                monedas: subtotalesMonedas,
                pendientes,
              })
            }
          />
        </div>
      )}
      </div>
    </div>
  );
}
