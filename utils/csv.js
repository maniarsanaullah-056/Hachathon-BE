// Chhota RFC-4180 style CSV parser/serializer (quotes, commas, newlines handle karta hai)

export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (inQuotes) throw new Error('CSV has an unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// CSV/Excel formula injection se bachao: = + - @ se shuru hone wali values ke aage ' lagta hai
const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsvCell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const toCsv = (headers, rows) =>
  [headers.join(','), ...rows.map((r) => headers.map((h) => toCsvCell(r[h])).join(','))].join('\r\n') +
  '\r\n';
