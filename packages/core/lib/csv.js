/**
 * csv.js — Pure CSV serialization for client-side report export.
 *
 * `toCsv` is intentionally DOM-free so it is unit-testable and reusable.
 * The component that triggers the download owns the Blob / anchor part.
 *
 * RFC-4180-ish escaping: a field is quoted when it contains a comma, a
 * double-quote, a CR, or an LF; embedded double-quotes are doubled.
 */

/** Escape a single CSV field. */
function escapeCsvField(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of flat objects into a CSV string.
 *
 * Columns are the union of keys across all rows, ordered by first
 * appearance — so a sparse row never silently drops a column another row
 * has. Returns '' for an empty / non-array input.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const columns = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  if (columns.length === 0) return '';

  const lines = [columns.map(escapeCsvField).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row?.[c])).join(','));
  }
  return lines.join('\r\n');
}
