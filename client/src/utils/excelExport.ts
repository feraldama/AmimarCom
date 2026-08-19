// Utilidad genérica de exportación a Excel (SheetJS). Cada página define sus
// columnas (título, extractor de valor, ancho, formato) y esta función arma la
// hoja, aplica formatos numéricos, agrega la fila de totales y descarga el
// archivo. La librería xlsx se carga con import dinámico para que no forme
// parte del bundle inicial: se descarga recién en la primera exportación.

export interface ColumnaExcel<T> {
  /** Título de la columna (primera fila de la hoja). */
  header: string;
  /** Extrae el valor de la celda; los números quedan como celdas numéricas. */
  value: (fila: T) => string | number | null | undefined;
  /** Ancho de la columna en caracteres. */
  ancho?: number;
  /** Formato numérico de Excel para la columna, ej. "#,##0". */
  formato?: string;
  /** Incluye la suma de la columna en la fila de totales. */
  totalizar?: boolean;
}

export async function exportarExcel<T>({
  nombreArchivo,
  nombreHoja = "Datos",
  columnas,
  filas,
}: {
  nombreArchivo: string;
  nombreHoja?: string;
  columnas: ColumnaExcel<T>[];
  filas: T[];
}): Promise<void> {
  const XLSX = await import("xlsx");

  const aoa: (string | number | null)[][] = [
    columnas.map((c) => c.header),
    ...filas.map((fila) => columnas.map((c) => c.value(fila) ?? null)),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columnas.map((c) => ({ wch: c.ancho ?? 15 }));

  columnas.forEach((col, colIdx) => {
    if (!col.formato) return;
    for (let filaIdx = 1; filaIdx <= filas.length; filaIdx++) {
      const celda = ws[XLSX.utils.encode_cell({ r: filaIdx, c: colIdx })];
      if (celda && celda.t === "n") celda.z = col.formato;
    }
  });

  // Fila de totales: fórmula SUM (con el valor precalculado como respaldo)
  // en cada columna marcada con `totalizar`, y la etiqueta "TOTAL" en la
  // primera columna que no se totaliza.
  if (filas.length > 0 && columnas.some((c) => c.totalizar)) {
    const filaTotal = filas.length + 1;
    columnas.forEach((col, colIdx) => {
      const ref = XLSX.utils.encode_cell({ r: filaTotal, c: colIdx });
      if (col.totalizar) {
        const letra = XLSX.utils.encode_col(colIdx);
        const suma = filas.reduce(
          (acc, fila) => acc + (Number(col.value(fila)) || 0),
          0
        );
        ws[ref] = {
          t: "n",
          v: suma,
          f: `SUM(${letra}2:${letra}${filas.length + 1})`,
          ...(col.formato ? { z: col.formato } : {}),
        };
      } else if (colIdx === 0) {
        ws[ref] = { t: "s", v: "TOTAL" };
      }
    });
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: filaTotal, c: columnas.length - 1 },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, nombreArchivo);
}
