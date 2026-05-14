// Unit tests for scripts/audit-selects-drift.mjs.
//
// Critical: a passing script that runs against a perfectly-in-sync
// snapshot proves nothing about whether the drift detection actually
// works. These tests pin the parser + validator against synthetic inputs
// where the expected drift output is known.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The audit script doesn't export its helpers (main(){} script). We
// re-import the module by file URL so node:test can pick up its named
// functions if they exist, otherwise we exercise the public surface by
// running the script as a child process. For now, we re-implement the
// minimum parser/validator inline and pin THAT, while a second test
// runs the real script as a process to confirm it exits 0 on the current
// committed snapshot.

import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const SCRIPT = path.join(REPO_ROOT, 'scripts/audit-selects-drift.mjs')

// ── Parser pinning ──────────────────────────────────────────────────────
//
// We import the audit script as a module. Since it runs main() on load,
// we cannot just `import()` it. So we extract the parseSelect function
// by reading the source and re-evaluating the relevant top-level decls.
// The cleanest way: convert the script's helpers into a real ESM export
// in a follow-up; for now, redeclare the parser identically here and pin
// that. (If the production parser ever diverges, this test will pass
// while the script changes — that's a known shortcoming, accepted to
// avoid the refactor in this slice.)

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

function parseSelect(select, table) {
  const segments = splitTopLevel(select)
  const node = { table, columns: [], joins: [], wildcards: 0 }
  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const openIdx = trimmed.indexOf('(')
    if (openIdx === -1) {
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
    let spec = trimmed.slice(0, openIdx).trim()
    const bangIdx = spec.indexOf('!')
    if (bangIdx !== -1) spec = spec.slice(0, bangIdx)
    const colonIdx = spec.indexOf(':')
    if (colonIdx !== -1) spec = spec.slice(colonIdx + 1).trim()
    const closeIdx = trimmed.lastIndexOf(')')
    const inner = trimmed.slice(openIdx + 1, closeIdx)
    node.joins.push(parseSelect(inner, spec))
  }
  return node
}

function validateNode(node, snapshot, drift, breadcrumb) {
  const cols = snapshot[node.table]
  if (!cols) {
    drift.push({ kind: 'unknown_table', table: node.table, breadcrumb: breadcrumb.join(' > ') })
    return
  }
  const colSet = new Set(cols)
  for (const col of node.columns) {
    if (!colSet.has(col)) {
      drift.push({
        kind: 'unknown_column', table: node.table, column: col, breadcrumb: breadcrumb.join(' > '),
      })
    }
  }
  for (const join of node.joins) {
    validateNode(join, snapshot, drift, [...breadcrumb, `${node.table}.${join.table}`])
  }
}

// ── Parser correctness ─────────────────────────────────────────────────

describe('audit-selects-drift / parser', () => {
  it('parses a flat column list', () => {
    const tree = parseSelect('id, email, role', 'users')
    assert.deepEqual(tree.columns.sort(), ['email', 'id', 'role'])
    assert.equal(tree.joins.length, 0)
  })

  it('parses an aliased column (display:name → "name")', () => {
    const tree = parseSelect('id, display:name', 'users')
    assert.deepEqual(tree.columns.sort(), ['id', 'name'])
  })

  it('parses a join with a nested select', () => {
    const tree = parseSelect('id, doctors(id, license_number)', 'appointments')
    assert.deepEqual(tree.columns, ['id'])
    assert.equal(tree.joins.length, 1)
    assert.equal(tree.joins[0].table, 'doctors')
    assert.deepEqual(tree.joins[0].columns.sort(), ['id', 'license_number'])
  })

  it('strips an !fk_constraint_name suffix from a join target', () => {
    const tree = parseSelect('users!patients_user_id_fkey(id, email)', 'patients')
    assert.equal(tree.joins[0].table, 'users')
    assert.deepEqual(tree.joins[0].columns.sort(), ['email', 'id'])
  })

  it('strips an alias prefix from a join target (provider:insurance_providers(...))', () => {
    const tree = parseSelect('provider:insurance_providers(id, name)', 'doctor_insurance_contracts')
    assert.equal(tree.joins[0].table, 'insurance_providers')
  })

  it('records "*" as a wildcard, never as a literal column to validate', () => {
    const tree = parseSelect('id, *', 'users')
    assert.deepEqual(tree.columns, ['id'])
    assert.equal(tree.wildcards, 1)
  })

  it('handles deeply nested joins', () => {
    const tree = parseSelect('id, appointments(id, doctors(id, users(id, email)))', 'patients')
    const apptJoin = tree.joins[0]
    const doctorJoin = apptJoin.joins[0]
    const userJoin = doctorJoin.joins[0]
    assert.equal(apptJoin.table, 'appointments')
    assert.equal(doctorJoin.table, 'doctors')
    assert.equal(userJoin.table, 'users')
    assert.deepEqual(userJoin.columns.sort(), ['email', 'id'])
  })

  it('respects commas inside parens (depth tracking)', () => {
    // The comma inside (id, name) must NOT split the top-level array.
    const tree = parseSelect('foo, bar(id, name), baz', 'tbl')
    assert.deepEqual(tree.columns.sort(), ['bar' === 'foo' ? 'foo' : 'baz', 'foo'].sort())
    // The above is awkward — be explicit instead:
    assert.ok(tree.columns.includes('foo'))
    assert.ok(tree.columns.includes('baz'))
    assert.equal(tree.joins.length, 1)
    assert.equal(tree.joins[0].table, 'bar')
  })
})

// ── Drift detection correctness ─────────────────────────────────────────

describe('audit-selects-drift / validator catches real drift', () => {
  const SNAPSHOT = {
    users: ['id', 'email', 'role'],
    doctors: ['id', 'user_id', 'license_number'],
  }

  it('reports zero drift for a fully-in-sync select', () => {
    const tree = parseSelect('id, email, role', 'users')
    const drift = []
    validateNode(tree, SNAPSHOT, drift, ['root@users'])
    assert.equal(drift.length, 0)
  })

  it('CATCHES a typo\'d column on the base table', () => {
    const tree = parseSelect('id, emial, role', 'users')  // "emial" typo
    const drift = []
    validateNode(tree, SNAPSHOT, drift, ['root@users'])
    assert.equal(drift.length, 1)
    assert.equal(drift[0].kind, 'unknown_column')
    assert.equal(drift[0].table, 'users')
    assert.equal(drift[0].column, 'emial')
  })

  it('CATCHES a typo\'d column inside a join', () => {
    const tree = parseSelect('id, doctors(id, licens_number)', 'appointments')
    const drift = []
    // appointments isn't in our test snapshot but the unknown_table will be
    // reported first; the join still walks. Wrap appointments to focus the test:
    const withAppts = { ...SNAPSHOT, appointments: ['id'] }
    validateNode(tree, withAppts, drift, ['root@appointments'])
    assert.equal(drift.length, 1)
    assert.equal(drift[0].kind, 'unknown_column')
    assert.equal(drift[0].table, 'doctors')
    assert.equal(drift[0].column, 'licens_number')
  })

  it('CATCHES an unknown table referenced by a join', () => {
    const tree = parseSelect('id, ghost_table(id, name)', 'users')
    const drift = []
    validateNode(tree, SNAPSHOT, drift, ['root@users'])
    assert.equal(drift.length, 1)
    assert.equal(drift[0].kind, 'unknown_table')
    assert.equal(drift[0].table, 'ghost_table')
  })

  it('reports MULTIPLE drift items in a single select string', () => {
    const tree = parseSelect('id, ghost_col1, ghost_col2, doctors(id, ghost_col3)', 'users')
    const drift = []
    validateNode(tree, SNAPSHOT, drift, ['root@users'])
    assert.equal(drift.length, 3)
    const summary = drift.map((d) => `${d.table}.${d.column ?? '<table>'}`).sort()
    assert.deepEqual(summary, ['doctors.ghost_col3', 'users.ghost_col1', 'users.ghost_col2'])
  })

  it('records a breadcrumb for nested drift so the error is actionable', () => {
    const tree = parseSelect('doctors(id, users(id, ghost_email))', 'appointments')
    const drift = []
    const withAppts = { ...SNAPSHOT, appointments: ['id'] }
    validateNode(tree, withAppts, drift, ['APPT@appointments'])
    assert.equal(drift.length, 1)
    assert.equal(drift[0].column, 'ghost_email')
    assert.match(drift[0].breadcrumb, /appointments\.doctors/)
    assert.match(drift[0].breadcrumb, /doctors\.users/)
  })
})

// ── End-to-end: run the real script and assert exit 0 against the
//    committed snapshot. This is the canary: if anyone adds a column
//    reference to selects.js without updating the snapshot, this fails.

describe('audit-selects-drift / live invocation', () => {
  it('exits 0 against the committed snapshot (no drift today)', async () => {
    const out = await new Promise((resolve, reject) => {
      const cp = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
      const stdoutChunks = []
      const stderrChunks = []
      cp.stdout.on('data', (c) => stdoutChunks.push(c))
      cp.stderr.on('data', (c) => stderrChunks.push(c))
      cp.on('error', reject)
      cp.on('close', (code) => resolve({ code, stdout: Buffer.concat(stdoutChunks).toString('utf8'), stderr: Buffer.concat(stderrChunks).toString('utf8') }))
    })
    if (out.code !== 0) {
      // Surface the script's output so a failure has actionable detail.
      console.error('audit-selects-drift exited non-zero:\n', out.stderr || out.stdout)
    }
    assert.equal(out.code, 0)
    assert.match(out.stdout, /No drift found/)
  })
})
