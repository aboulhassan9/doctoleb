import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const VIEWS_DIR = path.join(ROOT, "docs", "erd", "views");
const OUTPUT_DIR = path.join(ROOT, "docs", "erd", "rendered");

const COLORS = [
  { bg: "#e8f7ff", stroke: "#0891b2", title: "#0e7490" },
  { bg: "#ecfdf3", stroke: "#16a34a", title: "#15803d" },
  { bg: "#fff7ed", stroke: "#f97316", title: "#c2410c" },
  { bg: "#f5f3ff", stroke: "#7c3aed", title: "#6d28d9" },
  { bg: "#fdf2f8", stroke: "#db2777", title: "#be185d" },
  { bg: "#f8fafc", stroke: "#64748b", title: "#475569" },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseDbml(dbml) {
  const projectName = dbml.match(/Project\s+"([^"]+)"/)?.[1] ?? "DoctoLeb ERD";
  const tables = new Map();
  const groups = [];
  const refs = [];

  for (const match of dbml.matchAll(/Table\s+([A-Za-z_][\w.]*?)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match;
    const columns = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("Note:") && !line.startsWith("Note {"))
      .map((line) => {
        const parts = line.split(/\s+/);
        return {
          name: parts[0],
          type: parts[1] ?? "text",
          isPk: /\[.*\bpk\b.*\]/.test(line),
          isRequired: /\[.*not null.*\]/.test(line),
        };
      });
    tables.set(name, { name, columns, group: null });
  }

  for (const match of dbml.matchAll(/TableGroup\s+"?([^"{\[]+?)"?\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\n\}/g)) {
    const [, rawName, body] = match;
    const groupName = rawName.trim();
    const groupTables = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => tables.has(line));
    groups.push({ name: groupName, tables: groupTables });
    for (const table of groupTables) {
      tables.get(table).group = groupName;
    }
  }

  const ungrouped = [...tables.keys()].filter((name) => !tables.get(name).group);
  if (ungrouped.length > 0) {
    groups.push({ name: "Other", tables: ungrouped });
  }

  for (const match of dbml.matchAll(/Ref:\s+([A-Za-z_][\w.]*)\.([A-Za-z_][\w]*)\s*>\s*([A-Za-z_][\w.]*)\.([A-Za-z_][\w]*)/g)) {
    refs.push({
      fromTable: match[1],
      fromColumn: match[2],
      toTable: match[3],
      toColumn: match[4],
    });
  }

  return { projectName, tables, groups, refs };
}

function isDetailView(fileName) {
  return /(^1\d-|detail|actions)/i.test(fileName);
}

function layoutDiagram(model, options = {}) {
  const detail = options.detail === true;
  const cardWidth = detail ? 340 : 290;
  const minCardHeight = detail ? 108 : 118;
  const rowHeight = detail ? 16 : 18;
  const groupGap = 42;
  const cardGap = 24;
  const padding = 36;
  const headerHeight = 76;
  const footerHeight = 34;
  const groupWidth = cardWidth + 28;
  const positions = new Map();

  let maxHeight = 0;

  model.groups.forEach((group, groupIndex) => {
    const x = padding + groupIndex * (groupWidth + groupGap);
    let y = padding + headerHeight;
    for (const tableName of group.tables) {
      const table = model.tables.get(tableName);
      const maxColumns = detail ? table.columns.length : 9;
      const visibleColumns = table.columns.slice(0, maxColumns);
      const overflow = Math.max(0, table.columns.length - visibleColumns.length);
      const height = Math.max(
        minCardHeight,
        54 + visibleColumns.length * rowHeight + (overflow > 0 ? rowHeight : 0),
      );
      positions.set(tableName, {
        x,
        y,
        width: cardWidth,
        height,
        visibleColumns,
        overflow,
        groupIndex,
      });
      y += height + cardGap;
    }
    maxHeight = Math.max(maxHeight, y);
  });

  return {
    positions,
    width: padding * 2 + model.groups.length * groupWidth + Math.max(0, model.groups.length - 1) * groupGap,
    height: maxHeight + footerHeight,
  };
}

function relationPath(from, to) {
  const fromRight = from.x + from.width;
  const toLeft = to.x;
  const fromLeft = from.x;
  const toRight = to.x + to.width;
  const fromY = from.y + from.height / 2;
  const toY = to.y + to.height / 2;

  if (fromRight <= toLeft) {
    const midX = (fromRight + toLeft) / 2;
    return `M ${fromRight} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toLeft} ${toY}`;
  }

  if (toRight <= fromLeft) {
    const midX = (toRight + fromLeft) / 2;
    return `M ${fromLeft} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toRight} ${toY}`;
  }

  const x = Math.max(fromRight, toRight) + 24;
  return `M ${fromRight} ${fromY} C ${x} ${fromY}, ${x} ${toY}, ${toRight} ${toY}`;
}

function renderSvg(model, options = {}) {
  const detail = options.detail === true;
  const layout = layoutDiagram(model, options);
  const parts = [];

  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeXml(model.projectName)}">`,
  );
  parts.push(`<defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.10"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/>
    </marker>
  </defs>`);
  parts.push(`<rect width="100%" height="100%" fill="#f8fbfa"/>`);
  parts.push(`<text x="36" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#020617">${escapeXml(model.projectName)}</text>`);
  parts.push(
    `<text x="36" y="66" font-family="Arial, sans-serif" font-size="12" fill="#64748b">${detail ? "Detailed ERD view with all columns shown" : "Generated from curated DBML documentation views"}</text>`,
  );

  for (const ref of model.refs) {
    const from = layout.positions.get(ref.fromTable);
    const to = layout.positions.get(ref.toTable);
    if (!from || !to) continue;
    parts.push(
      `<path d="${relationPath(from, to)}" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-opacity="0.58" marker-end="url(#arrow)"/>`,
    );
  }

  model.groups.forEach((group, groupIndex) => {
    const color = COLORS[groupIndex % COLORS.length];
    const first = layout.positions.get(group.tables[0]);
    if (!first) return;
    parts.push(
      `<text x="${first.x}" y="92" font-family="Arial, sans-serif" font-size="13" font-weight="800" letter-spacing="2" fill="${color.title}">${escapeXml(group.name.toUpperCase())}</text>`,
    );
  });

  for (const [tableName, table] of model.tables.entries()) {
    const pos = layout.positions.get(tableName);
    if (!pos) continue;
    const color = COLORS[pos.groupIndex % COLORS.length];
    parts.push(
      `<g filter="url(#shadow)">
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="18" fill="#ffffff" stroke="${color.stroke}" stroke-width="1.4"/>
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="42" rx="18" fill="${color.bg}"/>
        <path d="M ${pos.x} ${pos.y + 28} h ${pos.width} v 14 h -${pos.width} z" fill="${color.bg}"/>
        <text x="${pos.x + 16}" y="${pos.y + 27}" font-family="Arial, sans-serif" font-size="${detail && tableName.length > 30 ? 12 : 14}" font-weight="800" fill="#0f172a">${escapeXml(tableName)}</text>`,
    );

    let y = pos.y + 64;
    for (const column of pos.visibleColumns) {
      const marker = column.isPk ? "PK" : column.isRequired ? "*" : "";
      const markerFill = column.isPk ? "#f59e0b" : "#94a3b8";
      if (marker) {
        parts.push(`<text x="${pos.x + 16}" y="${y}" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="${markerFill}">${marker}</text>`);
      }
      parts.push(`<text x="${pos.x + 44}" y="${y}" font-family="Arial, sans-serif" font-size="${detail ? 10 : 11}" fill="#334155">${escapeXml(column.name)}</text>`);
      parts.push(`<text x="${pos.x + pos.width - 16}" y="${y}" text-anchor="end" font-family="Arial, sans-serif" font-size="${detail ? 9 : 10}" fill="#64748b">${escapeXml(column.type)}</text>`);
      y += detail ? 16 : 18;
    }

    if (pos.overflow > 0) {
      parts.push(`<text x="${pos.x + 16}" y="${y}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">+ ${pos.overflow} more columns</text>`);
    }

    parts.push(`</g>`);
  }

  parts.push(`<text x="36" y="${layout.height - 16}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">DoctoLeb ${detail ? "detailed" : "curated"} ERD documentation view</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = (await readdir(VIEWS_DIR))
    .filter((file) => file.endsWith(".dbml"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const dbml = await readFile(path.join(VIEWS_DIR, file), "utf8");
    const model = parseDbml(dbml);
    const svg = renderSvg(model, { detail: isDetailView(file) });
    const outputFile = file.replace(/\.dbml$/, ".svg");
    await writeFile(path.join(OUTPUT_DIR, outputFile), svg, "utf8");
    console.log(`rendered ${outputFile}`);
  }
}

await main();
