/**
 * reportLabels.js — Shared column-label resolution for analytical reports.
 *
 * Centralizes the `resolveColumnLabel` function that was duplicated across
 * ChartRenderer, ReportViewerPage, and ReportEditorPage. All three now
 * import from this single source to avoid drift.
 *
 * Uses REPORT_DATA_SOURCE_COLUMN_TYPES metadata when available; falls back
 * to a pretty-print heuristic (strip _id suffix, replace underscores,
 * capitalize words).
 */

import { REPORT_DATA_SOURCE_COLUMN_TYPES } from '../schemas/analyticalReports.js';

/**
 * Resolve a human-friendly label for a column key within a data source.
 * Uses REPORT_DATA_SOURCE_COLUMN_TYPES metadata; falls back to pretty-print.
 *
 * @param {string} dataSource — e.g. 'appointments', 'encounters'
 * @param {string} columnKey  — e.g. 'doctor_id', 'status'
 * @returns {string} Human-friendly label
 */
export function resolveColumnLabel(dataSource, columnKey) {
  if (!columnKey) return '';
  const typeMap = REPORT_DATA_SOURCE_COLUMN_TYPES[dataSource];
  if (typeMap && typeMap[columnKey] && typeMap[columnKey].label) {
    return typeMap[columnKey].label;
  }
  // Fallback: strip _id suffix, replace underscores, capitalize words
  return columnKey
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}