import { jsPDF } from "jspdf";

/**
 * Helpers compartidos para los reportes PDF (encabezado, pie de página,
 * colores y formatos comunes). Usarlos en todos los reportes para mantener
 * un diseño consistente.
 */

type RGB = [number, number, number];

export const PDF_COLORS: Record<string, RGB> = {
  primary: [22, 163, 74], // verde del sistema
  ingreso: [16, 185, 129],
  egreso: [220, 38, 38],
  totalFill: [241, 245, 249],
  textDark: [30, 41, 59],
  textMuted: [100, 116, 139],
  line: [203, 213, 225],
};

export const fmtFecha = (fecha: string) => {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

/** Fecha y hora cortas (dd/mm/aa hh:mm) para las filas de detalle. */
export const fmtFechaHora = (fecha: string) => {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

/** Abre el PDF en una pestaña nueva. */
export const abrirPdf = (doc: jsPDF) => {
  window.open(doc.output("bloburl") as unknown as string, "_blank");
};
