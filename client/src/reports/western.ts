import { jsPDF } from "jspdf";
import { getReporteWestern } from "../services/registros.service";
import { formatMiles, formatMilesSmart } from "../utils/utils";
import {
  PDF_COLORS,
  pdfHeader,
  pdfFooter,
  pdfSeccion,
  pdfCuadroControl,
  pdfNota,
  abrirPdf,
  SinDatosError,
  validarRango,
  type RGB,
} from "../utils/pdfReport";

interface WesternMovimiento {
  RegistroDiarioCajaId: number;
  GrupoDescripcion: string;
  Detalle: string;
  Fecha: string;
  Monto: number;
  Cambio: number;
  MTCN: number;
  CajaDescripcion: string;
  UsuarioId: string;
  UsuarioNombre: string;
}

export async function generarWesternGs(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const r = await getReporteWestern(desde, hasta, "gs");
  const egresos = (r.egresos || []) as WesternMovimiento[];
  const ingresos = (r.ingresos || []) as WesternMovimiento[];
  if (!egresos.length && !ingresos.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  const doc = new jsPDF();
  let y = pdfHeader(doc, "Western - Ingresos/Egresos (Gs.)", desde, hasta);

  const seccion = (titulo: string, rows: WesternMovimiento[], total: number, color: RGB) =>
    pdfSeccion(doc, y, titulo, {
      head: ["Registro", "Detalle", "Concepto", "Caja", "Usuario", "Monto Gs."],
      body: rows.map((m) => [
        m.RegistroDiarioCajaId,
        m.Detalle,
        m.GrupoDescripcion,
        m.CajaDescripcion,
        m.UsuarioNombre || m.UsuarioId || "",
        formatMiles(Number(m.Monto)),
      ]),
      foot: [`TOTAL ${titulo}`, "", "", "", "", formatMiles(total)],
      headColor: color,
      columnStyles: { 5: { halign: "right" } },
    });

  y = seccion("EGRESOS", egresos, Number(r.totalEgresos), PDF_COLORS.egreso);
  y = seccion("INGRESOS", ingresos, Number(r.totalIngresos), PDF_COLORS.ingreso);

  pdfCuadroControl(doc, y, [
    ["EGRESOS", formatMiles(Number(r.totalEgresos))],
    ["INGRESOS", formatMiles(Number(r.totalIngresos))],
    ["DIFERENCIA", formatMiles(Number(r.diferencia))],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "western-gs.pdf");
}

export async function generarWesternUsd(desde: string, hasta: string) {
  validarRango(desde, hasta);
  const r = await getReporteWestern(desde, hasta, "usd");
  const egresos = (r.egresos || []) as WesternMovimiento[];
  const ingresos = (r.ingresos || []) as WesternMovimiento[];
  if (!egresos.length && !ingresos.length) {
    throw new SinDatosError("No hay datos para el periodo seleccionado");
  }

  const usd = (m: WesternMovimiento) =>
    Number(m.Cambio) > 0 ? Number(m.Monto) / Number(m.Cambio) : 0;
  const totalUsd = (rows: WesternMovimiento[]) => rows.reduce((s, m) => s + usd(m), 0);
  const sinCotizacion = [...egresos, ...ingresos].filter((m) => !(Number(m.Cambio) > 0)).length;

  const doc = new jsPDF("landscape");
  let y = pdfHeader(doc, "Western USD - Ingresos/Egresos", desde, hasta);

  const seccion = (titulo: string, rows: WesternMovimiento[], color: RGB) =>
    pdfSeccion(doc, y, titulo, {
      head: ["Registro", "Detalle", "Concepto", "Caja", "Usuario", "Cotización", "Monto Gs.", "Monto U$D"],
      body: rows.map((m) => [
        m.RegistroDiarioCajaId,
        m.Detalle,
        m.GrupoDescripcion,
        m.CajaDescripcion,
        m.UsuarioNombre || m.UsuarioId || "",
        Number(m.Cambio) > 0 ? formatMilesSmart(Number(m.Cambio)) : "—",
        formatMiles(Number(m.Monto)),
        Number(m.Cambio) > 0 ? formatMilesSmart(usd(m)) : "—",
      ]),
      foot: [`TOTAL ${titulo}`, "", "", "", "", "",
        formatMiles(rows.reduce((s, m) => s + Number(m.Monto), 0)),
        formatMilesSmart(totalUsd(rows)),
      ],
      headColor: color,
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    });

  y = seccion("EGRESOS", egresos, PDF_COLORS.egreso);
  y = seccion("INGRESOS", ingresos, PDF_COLORS.ingreso);

  if (sinCotizacion > 0) {
    y = pdfNota(
      doc, y,
      `${sinCotizacion} registro(s) sin cotización cargada (marcados con —) no suman al total U$D.`
    );
  }

  const totEgrUsd = totalUsd(egresos);
  const totIngUsd = totalUsd(ingresos);
  pdfCuadroControl(doc, y, [
    ["EGRESOS U$D", formatMilesSmart(totEgrUsd)],
    ["INGRESOS U$D", formatMilesSmart(totIngUsd)],
    ["DIFERENCIA U$D", formatMilesSmart(totEgrUsd - totIngUsd)],
  ]);

  pdfFooter(doc);
  abrirPdf(doc, "western-usd.pdf");
}
