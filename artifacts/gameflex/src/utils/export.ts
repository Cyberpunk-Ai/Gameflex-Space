// @ts-nocheck
export function toCSV(data: any[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n') ? '"' + str.replace(/"/g, '""') + '"' : str;
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsJSON(data: any, filename: string) {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function exportAsCSV(data: any[], filename: string) {
  downloadFile(toCSV(data), filename, 'text/csv');
}

export function getExportFilename(table: string, format: 'json' | 'csv'): string {
  const date = new Date().toISOString().split('T')[0];
  return 'gameflex_' + table + '_' + date + '.' + format;
}
