// Planillas (Excel / CSV / ODS) → texto para la IA: un renglón por fila, celdas separadas por ";"
// Se usa en el navegador (la librería xlsx se carga recién cuando hace falta).
export const SHEET_ACCEPT = ".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet";

export const isSheet = (f: File) => /\.(xlsx|xls|csv|ods)$/i.test(f.name) || /spreadsheet|excel|csv/.test(f.type);

/** Lee todas las hojas y devuelve las filas con contenido, como texto "celda;celda;celda" */
export async function sheetLines(file: File): Promise<string[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, raw: false });
    for (const r of rows) {
      const cells = r.map((c) => String(c ?? "").replace(/[;\n\r]+/g, " ").trim());
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.some(Boolean)) lines.push(cells.join(";"));
    }
  }
  if (!lines.length) throw new Error("La planilla está vacía");
  return lines;
}
