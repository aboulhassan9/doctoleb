/**
 * pdfReport.ts — pdf-lib rendering for analytical-report PDF export.
 *
 * Native primitives only (text / rectangles / lines) — no SVG and no chart
 * library — so the output is deterministic and the function stays light.
 * pinned pdf-lib@1.17.1, the same version the clinical-document renderer
 * uses (see docs/plans/clinical-documents-and-medication-catalog.md § 15).
 */

import {
  PDFDocument, PDFPage, StandardFonts, rgb,
} from 'https://esm.sh/pdf-lib@1.17.1';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H = 18;
const BOTTOM = MARGIN + 24;

const COLORS = {
  ink: rgb(0.06, 0.09, 0.16),       // slate-900
  muted: rgb(0.39, 0.45, 0.55),     // slate-500
  line: rgb(0.89, 0.91, 0.94),      // slate-200
  headerBg: rgb(0.95, 0.96, 0.98),  // slate-100
  bar: rgb(0.15, 0.39, 0.92),       // blue-600
};

export type RenderInput = {
  reportName: string;
  tenantName: string;
  definition: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  columnLabels: Record<string, string>;
  filterSummary: string;
  generatedAt: Date;
};

/** YYYY-MM-DD HH:MM — deterministic, locale-free. */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function fmtCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

export async function renderReportPdf(input: RenderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(input.reportName);
  doc.setProducer('DoctoLeb / pdf-lib');
  doc.setCreator('DoctoLeb render-analytical-report-pdf');

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  const truncate = (text: string, size: number, maxWidth: number, useFont = font): string => {
    if (useFont.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && useFont.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
      t = t.slice(0, -1);
    }
    return `${t}…`;
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN;
  };

  // ── Header band ──
  if (input.tenantName) {
    page.drawText(truncate(input.tenantName, 11, CONTENT_W, fontBold), {
      x: MARGIN, y: y - 4, size: 11, font: fontBold, color: COLORS.muted,
    });
    y -= 18;
  }
  page.drawText(truncate(input.reportName, 20, CONTENT_W, fontBold), {
    x: MARGIN, y: y - 18, size: 20, font: fontBold, color: COLORS.ink,
  });
  y -= 32;

  const metaParts = [`Generated ${fmtDate(input.generatedAt)} UTC`];
  if (input.filterSummary) metaParts.push(input.filterSummary);
  page.drawText(truncate(metaParts.join('   ·   '), 9, CONTENT_W), {
    x: MARGIN, y: y - 4, size: 9, font, color: COLORS.muted,
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: COLORS.line,
  });
  y -= 26;

  const columns = input.rows.length ? Object.keys(input.rows[0]) : [];
  if (!input.rows.length || !columns.length) {
    page.drawText('No data for this report.', {
      x: MARGIN, y: y - 10, size: 11, font, color: COLORS.muted,
    });
    return doc.save();
  }

  // ── Optional native bar chart (bar / stacked_bar viz) ──
  const viz = (input.definition?.visualization as { type?: string } | undefined)?.type;
  const groupBy = (input.definition?.groupBy as Array<{ column?: string; alias?: string }>) || [];
  const aggregations = (input.definition?.aggregations as Array<{ as?: string }>) || [];
  const groupKey = groupBy[0]?.alias || groupBy[0]?.column || null;
  const measureKey = aggregations[0]?.as || null;

  if ((viz === 'bar' || viz === 'stacked_bar') && groupKey && measureKey) {
    const chartRows = input.rows.slice(0, 12);
    const values = chartRows.map((r) => Number(r[measureKey]) || 0);
    const maxValue = Math.max(1, ...values);
    const chartH = 150;
    const chartBottom = y - chartH;
    const slot = CONTENT_W / chartRows.length;
    const barW = Math.min(40, slot * 0.6);

    page.drawText(input.columnLabels[measureKey] || measureKey, {
      x: MARGIN, y: y + 6, size: 9, font, color: COLORS.muted,
    });
    page.drawLine({
      start: { x: MARGIN, y: chartBottom }, end: { x: PAGE_W - MARGIN, y: chartBottom },
      thickness: 1, color: COLORS.line,
    });
    chartRows.forEach((r, i) => {
      const v = Number(r[measureKey]) || 0;
      const h = Math.max(1, (v / maxValue) * (chartH - 22));
      const barX = MARGIN + slot * i + (slot - barW) / 2;
      page.drawRectangle({
        x: barX, y: chartBottom, width: barW, height: h, color: COLORS.bar,
      });
      page.drawText(truncate(fmtCell(r[groupKey]), 7, slot - 4), {
        x: MARGIN + slot * i + 2, y: chartBottom - 11, size: 7, font, color: COLORS.muted,
      });
      const valLabel = fmtCell(v);
      page.drawText(valLabel, {
        x: barX + (barW - font.widthOfTextAtSize(valLabel, 7)) / 2,
        y: chartBottom + h + 3, size: 7, font, color: COLORS.muted,
      });
    });
    y = chartBottom - 30;
  }

  // ── Detail table ──
  const colW = CONTENT_W / columns.length;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN, y: y - ROW_H, width: CONTENT_W, height: ROW_H, color: COLORS.headerBg,
    });
    columns.forEach((c, i) => {
      page.drawText(truncate(input.columnLabels[c] || c, 9, colW - 8, fontBold), {
        x: MARGIN + colW * i + 4, y: y - 13, size: 9, font: fontBold, color: COLORS.ink,
      });
    });
    y -= ROW_H;
  };

  drawTableHeader();
  input.rows.forEach((row) => {
    if (y - ROW_H < BOTTOM) {
      newPage();
      drawTableHeader();
    }
    columns.forEach((c, i) => {
      page.drawText(truncate(fmtCell(row[c]), 9, colW - 8), {
        x: MARGIN + colW * i + 4, y: y - 13, size: 9, font, color: COLORS.ink,
      });
    });
    page.drawLine({
      start: { x: MARGIN, y: y - ROW_H }, end: { x: PAGE_W - MARGIN, y: y - ROW_H },
      thickness: 0.5, color: COLORS.line,
    });
    y -= ROW_H;
  });

  // ── Footers ──
  pages.forEach((p, i) => {
    p.drawText(truncate(`${input.reportName}   ·   Page ${i + 1} of ${pages.length}`, 8, CONTENT_W), {
      x: MARGIN, y: MARGIN - 14, size: 8, font, color: COLORS.muted,
    });
  });

  return doc.save();
}
