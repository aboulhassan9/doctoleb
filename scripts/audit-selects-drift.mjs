#!/usr/bin/env node
// audit-selects-drift.mjs
//
// Catches a class of bugs the service-layer unit tests CANNOT catch:
// drift between `packages/core/lib/selects.js` and the live DB schema.
//
// The unit tests mock supabase, so a typo'd column passes the mock and
// only fails as a 400 from PostgREST in production. This script imports
// the real selects.js, parses every constant as a PostgREST select
// string, and verifies every column referenced exists in the schema
// snapshot at tests/fixtures/db-schema-snapshot.json.
//
// What counts as a "select constant"
//   Any exported constant in selects.js that resolves to a non-empty
//   string. The script walks each one as a PostgREST select.
//
// How the (constant -> table) mapping is built
//   By grepping every file under packages/core/services/ for
//   `.from('TABLE').select(CONST)` patterns. Constants that are never
//   used as a TOP-LEVEL select arg (e.g. USER_CONTACT_FIELDS, which is
//   only inlined into joins) are skipped. Their columns get audited
//   recursively when their parent constant's join is walked.
//
// Refresh
//   The snapshot is committed and refreshed by re-running the snapshot
//   SQL when a migration lands. See docs/runbooks/refresh-schema-snapshot.md.
//
// Exit codes
//   0 - no drift
//   1 - drift found OR script-internal error (logged with detail)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SELECTS_FILE = path.join(ROOT, 'packages/core/lib/selects.js')
const SERVICES_DIR = path.join(ROOT, 'packages/core/services')
const SNAPSHOT_FILE = path.join(ROOT, 'tests/fixtures/db-schema-snapshot.json')

// ── PostgREST select-string parser ──────────────────────────────────────

/**
 * Split a select string on commas that are at top-level (depth 0).
 * `id, foo(a, b), baz` → ['id', ' foo(a, b)', ' baz']
 */
function splitTopLevel(str) {
  const out = []
  let depth = 0
  let current = ''
  for (const ch of str) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current)
  return out
}

/**
 * Parse a PostgREST select string into a tree:
 *   { table, columns: [...], joins: [{ table, columns, joins }] }
 *
 * Handles:
 *   - Plain columns: `id, name`
 *   - Aliased columns: `display:name` → column "name"
 *   - Joins: `doctors(id, name)` → join on `doctors`
 *   - FK joins: `users!doctors_user_id_fkey(...)` → join on `users`
 *   - Aliased joins: `provider:insurance_providers(...)` → join on `insurance_providers`
 *   - Wildcards: `*` → recorded as wildcard, never validated against snapshot
 */
function parseSelect(select, table) {
  const segments = splitTopLevel(select)
  const node = { table, columns: [], joins: [], wildcards: 0 }

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    const openIdx = trimmed.indexOf('(')
    if (openIdx === -1) {
      // Plain column (possibly aliased)
      if (trimmed === '*') {
        node.wildcards += 1
        continue
      }
      let colName = trimmed
      const colonIdx = colName.indexOf(':')
      if (colonIdx !== -1) colName = colName.slice(colonIdx + 1).trim()
      if (colName) node.columns.push(colName)
      continue
    }

    // It's a join. Extract the table spec before '(' and the inner select.
    let spec = trimmed.slice(0, openIdx).trim()
    // Strip the !fk_constraint_name suffix
    const bangIdx = spec.indexOf('!')
    if (bangIdx !== -1) spec = spec.slice(0, bangIdx)
    // Strip the alias: prefix
    const colonIdx = spec.indexOf(':')
    if (colonIdx !== -1) spec = spec.slice(colonIdx + 1).trim()

    const closeIdx = trimmed.lastIndexOf(')')
    const inner = trimmed.slice(openIdx + 1, closeIdx)
    node.joins.push(parseSelect(inner, spec))
  }

  return node
}

// ── (constant -> table) mapping by scanning service files ───────────────

function readServiceFiles() {
  const entries = fs.readdirSync(SERVICES_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => path.join(SERVICES_DIR, e.name))
}

/**
 * Find `.from('TABLE').select(CONST` (or `.select(CONST,`) patterns in service
 * files. Returns a Map<constName, Set<tableName>> — most constants will map to
 * exactly one table, but the script preserves the set so we can warn about
 * any constant used against multiple tables (a likely smell).
 */
function buildConstTableMap(serviceFiles) {
  const map = new Map()
  const FROM_RE = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)\s*\.select\(\s*([A-Z][A-Z0-9_]*)/g
  for (const file of serviceFiles) {
    const src = fs.readFileSync(file, 'utf8')
    let m
    while ((m = FROM_RE.exec(src)) !== null) {
      const [, table, constName] = m
      if (!map.has(constName)) map.set(constName, new Set())
      map.get(constName).add(table)
    }
  }
  return map
}

// ── Drift detection ─────────────────────────────────────────────────────

function validateNode(node, snapshot, drift, breadcrumb) {
  const cols = snapshot[node.table]
  if (!cols) {
    drift.push({
      kind: 'unknown_table',
      table: node.table,
      breadcrumb: breadcrumb.join(' > '),
    })
    return
  }
  const colSet = new Set(cols)
  for (const col of node.columns) {
    if (!colSet.has(col)) {
      drift.push({
        kind: 'unknown_column',
        table: node.table,
        column: col,
        breadcrumb: breadcrumb.join(' > '),
      })
    }
  }
  for (const join of node.joins) {
    validateNode(join, snapshot, drift, [...breadcrumb, `${node.table}.${join.table}`])
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.error(`Missing snapshot at ${SNAPSHOT_FILE}. Generate one first.`)
    process.exit(1)
  }
  const snapshotDoc = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
  const snapshot = snapshotDoc.schema || snapshotDoc

  const selects = await import(`file://${SELECTS_FILE.replaceAll('\\', '/')}`)
  const serviceFiles = readServiceFiles()
  const constTableMap = buildConstTableMap(serviceFiles)

  const drift = []
  let constantsAudited = 0
  let constantsSkipped = 0

  for (const [name, value] of Object.entries(selects)) {
    if (typeof value !== 'string' || !value.trim()) {
      continue
    }
    const tables = constTableMap.get(name)
    if (!tables || tables.size === 0) {
      constantsSkipped += 1
      continue
    }
    for (const table of tables) {
      const tree = parseSelect(value, table)
      constantsAudited += 1
      validateNode(tree, snapshot, drift, [`${name}@${table}`])
    }
  }

  // Report
  const lines = []
  lines.push('── selects.js / DB drift audit ──')
  lines.push(`Constants audited:     ${constantsAudited}`)
  lines.push(`Constants skipped:     ${constantsSkipped} (no .from(TABLE).select(CONST) match in services/)`)
  lines.push(`Snapshot tables:       ${Object.keys(snapshot).length}`)
  lines.push(`Snapshot generated at: ${snapshotDoc.$generatedAt ?? 'unknown'}`)
  lines.push(`Snapshot project:      ${snapshotDoc.$generatedFrom ?? 'unknown'}`)
  lines.push('')

  if (drift.length === 0) {
    lines.push('✅ No drift found.')
    console.log(lines.join('\n'))
    process.exit(0)
  }

  lines.push(`❌ ${drift.length} drift item(s) found:`)
  lines.push('')
  for (const item of drift) {
    if (item.kind === 'unknown_table') {
      lines.push(`  • UNKNOWN TABLE  ${item.table}  (in ${item.breadcrumb})`)
    } else {
      lines.push(`  • UNKNOWN COLUMN ${item.table}.${item.column}  (in ${item.breadcrumb})`)
    }
  }
  console.error(lines.join('\n'))
  process.exit(1)
}

main().catch((err) => {
  console.error('audit-selects-drift failed:', err)
  process.exit(1)
})
