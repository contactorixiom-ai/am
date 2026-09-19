// Export CSV — compatible Excel FR (séparateur « ; », BOM UTF-8 pour les accents).
// Sur le web : téléchargement direct d'un Blob. Sur natif : non pris en charge
// (l'espace admin de Roger s'utilise sur la version web / bureau).

export type CsvValue = string | number | null | undefined;

function escapeCell(v: CsvValue): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const sep = ';';
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(sep));
  // BOM pour qu'Excel ouvre l'UTF-8 correctement (accents FR).
  return '﻿' + lines.join('\r\n');
}

// Renvoie true si le téléchargement a été déclenché (web), false sinon (natif).
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
