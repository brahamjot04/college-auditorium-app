// src/utils/exportCsv.js

/**
 * Exports an array of objects to a CSV file and triggers an automatic browser download.
 * Sanitizes against CSV Formula Injection (CWE-1236) to prevent malicious spreadsheet formula execution.
 *
 * @param {string} filename - Desired download filename (e.g. "Event_Attendance.csv")
 * @param {Array<{ key: string, label: string }>} headers - Array of header definitions
 * @param {Array<Object>} rows - Array of data row objects
 */
export function exportToCsv(filename, headers, rows) {
  const escapeCell = (cell) => {
    if (cell === null || cell === undefined) return '""';
    let cellStr = String(cell);

    // Neutralize CSV Formula Injection (CWE-1236):
    // Prepend single quote if cell starts with dangerous spreadsheet formula triggers
    if (/^[=+\-@\t\r]/.test(cellStr)) {
      cellStr = "'" + cellStr;
    }

    // Escape internal quotes by doubling them
    cellStr = cellStr.replace(/"/g, '""');
    return `"${cellStr}"`;
  };

  const headerRow = headers.map((h) => escapeCell(h.label || h)).join(",");
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const key = typeof h === "object" ? h.key : h;
        const val = row[key];
        return escapeCell(val);
      })
      .join(","),
  );

  // \uFEFF adds the UTF-8 Byte Order Mark (BOM) so Excel renders all characters cleanly
  const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
