/**
 * Pure date utility functions for calendar views.
 * No side-effects, no React — safe to use anywhere.
 */

/** Zero-pad a number to 2 digits */
export const pad = (n) => String(n).padStart(2, '0');

/** Format an hour as "HH:00" */
export const fmtH = (h) => `${pad(h)}:00`;

/** Format hour + minute as "HH:MM" */
export const fmtHM = (h, m) => `${pad(h)}:${pad(m)}`;

/** Check if two Date objects are the same calendar day */
export const same = (a, b) => a.toDateString() === b.toDateString();

/** Convert a Date to "YYYY-MM-DD" key for month appointment lookup */
export const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Get Monday of the ISO week that contains `date`.
 * Returns a new Date set to 00:00:00.
 */
export function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Return the ISO week number for a given date.
 */
export function weekNum(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - y) / 86400000 + 1) / 7);
}

/**
 * Generate the array of day-numbers (and null padding) for a month-view grid.
 * @returns {(number|null)[]} — null for empty leading/trailing cells
 */
export function monthCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Convert JS getDay() (Sun=0) → Monday-first column index (Mon=0 … Sun=6) */
export const toWeekIdx = (day) => (day === 0 ? 6 : day - 1);
