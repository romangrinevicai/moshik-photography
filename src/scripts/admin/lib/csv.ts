/** CSV with a UTF-8 BOM so Excel opens Hebrew correctly. */
export function toCsv(rows: (string | number | undefined | null)[][]): Blob {
  const cell = (v: string | number | undefined | null) => {
    const s = v === undefined || v === null ? '' : String(v);
    // Guard against spreadsheet formula injection from client-entered text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const text = rows.map((r) => r.map(cell).join(',')).join('\r\n');
  return new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
}
