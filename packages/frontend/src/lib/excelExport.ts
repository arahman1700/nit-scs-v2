export interface ExcelColumn {
  header: string;
  key: string;
}

/**
 * Escape a value for CSV format.
 */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV string from data and column definitions.
 */
export function generateCSV(data: Record<string, unknown>[], columns: ExcelColumn[]): string {
  const header = columns.map(col => escapeCSV(col.header)).join(',');
  const rows = data.map(row => columns.map(col => escapeCSV(row[col.key])).join(','));
  return [header, ...rows].join('\n');
}

/**
 * Trigger a browser file download with the given content.
 */
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data as a CSV file (works in all browsers, no extra dependencies).
 * This is the frontend Excel/spreadsheet export approach -- CSV files
 * open natively in Excel, Google Sheets, etc.
 */
export function exportToExcel(data: Record<string, unknown>[], columns: ExcelColumn[], filename: string): void {
  const csv = generateCSV(data, columns);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const fullFilename = filename.endsWith('.csv') ? filename : `${filename}_${dateSuffix}.csv`;
  downloadBlob(csv, fullFilename, 'text/csv');
}
