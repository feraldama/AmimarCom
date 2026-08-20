import { jsPDF } from "jspdf";
import autoTable, { type UserOptions, type CellHookData, type RowInput } from "jspdf-autotable";

/**
 * Helpers compartidos para los reportes PDF (encabezado, pie de página,
 * secciones con tabla, cuadros de control, colores y formatos comunes).
 * Usarlos en todos los reportes para mantener un diseño consistente.
 */

export type RGB = [number, number, number];

export const PDF_COLORS: Record<string, RGB> = {
  primary: [22, 163, 74], // verde del sistema
  ingreso: [16, 185, 129],
  egreso: [220, 38, 38],
  totalFill: [241, 245, 249],
  textDark: [30, 41, 59],
  textMuted: [100, 116, 139],
  line: [203, 213, 225],
};

/** Error de negocio: el período consultado no tiene datos. */
export class SinDatosError extends Error {}

/** Valida el rango de fechas (formato ISO yyyy-mm-dd). */
export const validarRango = (desde: string, hasta: string) => {
  if (desde && hasta && desde > hasta) {
    throw new Error("La fecha 'Desde' no puede ser mayor que la fecha 'Hasta'");
  }
};

export const fmtFecha = (fecha: string) => {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

/** Fecha y hora cortas (dd/mm/aa hh:mm, formato 24hs) para las filas de detalle. */
export const fmtFechaHora = (fecha: string) => {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
};

export const getLastY = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/**
 * Si no queda espacio útil en la página agrega una nueva y devuelve la Y
 * inicial; si queda, devuelve la Y recibida. `reserva` es el alto (en mm)
 * que se pretende ocupar a continuación.
 */
export const asegurarEspacio = (doc: jsPDF, y: number, reserva = 45): number => {
  if (y > doc.internal.pageSize.getHeight() - reserva) {
    doc.addPage();
    return 20;
  }
  return y;
};

/**
 * Dibuja el encabezado estándar (empresa, título, período) y devuelve la
 * coordenada Y donde puede empezar el contenido.
 */
export const pdfHeader = (
  doc: jsPDF,
  titulo: string,
  fechaInicio: string,
  fechaFin: string
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.setFont("helvetica", "bold");
  doc.text("AMIMAR", 14, 14);

  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.textDark);
  doc.text(titulo, 14, 24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text(
    `Período: ${fmtFecha(fechaInicio)} al ${fmtFecha(fechaFin)}`,
    pageWidth - 14,
    24,
    { align: "right" }
  );

  doc.setDrawColor(...PDF_COLORS.primary);
  doc.setLineWidth(0.8);
  doc.line(14, 28, pageWidth - 14, 28);
  doc.setLineWidth(0.2);
  doc.setTextColor(...PDF_COLORS.textDark);

  return 36;
};

/**
 * Agrega el pie de página (numeración y fecha de generación) a todas las
 * páginas. Llamar una sola vez, al final, cuando el documento está completo.
 */
export const pdfFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generado = new Date().toLocaleString("es-PY");

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(`Generado el ${generado}`, 14, pageHeight - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 8, {
      align: "right",
    });
  }
  doc.setTextColor(...PDF_COLORS.textDark);
};

export interface SeccionTabla {
  head: RowInput;
  body: RowInput[];
  foot?: RowInput;
  headColor?: RGB;
  columnStyles?: UserOptions["columnStyles"];
  fontSize?: number;
  /** Índice de la columna cuyo valor INGRESO/EGRESO se colorea. */
  tipoColIndex?: number;
}

/**
 * Dibuja una sección: título opcional en negrita + tabla con encabezado de
 * color y fila de total al pie. Si `body` está vacío muestra `textoVacio` en
 * cursiva. Devuelve la Y donde puede continuar el contenido.
 */
export const pdfSeccion = (
  doc: jsPDF,
  y: number,
  titulo: string,
  tabla: SeccionTabla,
  textoVacio = "Sin movimientos en el período"
): number => {
  y = asegurarEspacio(doc, y);
  let startY = y;
  if (titulo) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(titulo, 14, y);
    doc.setFont("helvetica", "normal");
    startY = y + 3;
  }

  if (!tabla.body.length) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...PDF_COLORS.textMuted);
    doc.text(textoVacio, 14, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.textDark);
    return y + 16;
  }

  autoTable(doc, {
    head: [tabla.head],
    body: tabla.body,
    foot: tabla.foot ? [tabla.foot] : undefined,
    // El pie es la fila de totales del período: solo en la última página,
    // para que no parezca un subtotal por página.
    showFoot: "lastPage",
    startY,
    theme: "striped",
    headStyles: { fillColor: tabla.headColor ?? PDF_COLORS.primary },
    footStyles: {
      fillColor: PDF_COLORS.totalFill,
      textColor: PDF_COLORS.textDark,
      fontStyle: "bold",
    },
    styles: { fontSize: tabla.fontSize ?? 8 },
    columnStyles: tabla.columnStyles,
    margin: { left: 14, right: 14 },
    didParseCell:
      tabla.tipoColIndex === undefined
        ? undefined
        : (d: CellHookData) => {
            if (d.section === "body" && d.column.index === tabla.tipoColIndex) {
              d.cell.styles.textColor =
                d.cell.raw === "INGRESO" ? PDF_COLORS.ingreso : PDF_COLORS.egreso;
              d.cell.styles.fontStyle = "bold";
            }
          },
  });
  return getLastY(doc) + 12;
};

/**
 * Cuadro de control alineado a la derecha (pares etiqueta/valor en negrita),
 * con resaltado de color opcional en una fila.
 */
export const pdfCuadroControl = (
  doc: jsPDF,
  y: number,
  filas: [string, string][],
  resaltar?: { fila: number; color: RGB }
) => {
  y = asegurarEspacio(doc, y);
  const pageWidth = doc.internal.pageSize.getWidth();
  autoTable(doc, {
    body: filas,
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 10, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: pageWidth - 100, right: 14 },
    didParseCell: resaltar
      ? (d: CellHookData) => {
          if (d.row.index === resaltar.fila) {
            d.cell.styles.textColor = resaltar.color;
          }
        }
      : undefined,
  });
};

/** Nota al pie de una sección, en cursiva y color tenue. */
export const pdfNota = (doc: jsPDF, y: number, texto: string): number => {
  y = asegurarEspacio(doc, y, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.text(texto, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.textDark);
  return y + 6;
};

/**
 * Abre el PDF en una pestaña nueva. Si el navegador bloquea el popup,
 * lo descarga con el nombre indicado como alternativa.
 */
export const abrirPdf = (doc: jsPDF, nombre = "reporte.pdf") => {
  const url = doc.output("bloburl") as unknown as string;
  const win = window.open(url, "_blank");
  if (!win) doc.save(nombre);
};
