#!/usr/bin/env node
// audit-rpc-signatures.mjs
//
// Catches another class of bugs the service-layer unit tests cannot:
// drift between `supabase.rpc('name', { args })` calls in services and
// the SQL function signatures defined in supabase/migrations/.
//
// Mock tests pass because the mock returns whatever the test prescribes.
// In production, a misspelled arg name (or one missing from the SQL
// definition) becomes a PostgREST 404 / 400 at runtime.
//
// What it checks
//   For every `.rpc('name', { p_arg1: ..., p_arg2: ... })` call found in
//   packages/core/services/**/*.js:
//     1. A matching `create or replace function public.name(...)` exists
//        in supabase/migrations/**.sql OR
//        supabase-control-plane/migrations/**.sql.
//     2. Every key passed in the args object appears as a parameter on
//        the latest definition of that function (later migrations win).
//
// What it does NOT check
//   - Argument types (uuid vs text, etc.)
//   - Argument order (PostgREST is order-insensitive for named args)
//   - Defaults (the audit just checks names)
//   - RPC calls with a variable second arg (e.g. `rpc(name, rpcPayload)`)
//     where the keys are not statically determinable — those are listed
//     under "skipped (dynamic args)" so a reviewer knows to spot-check.
//
// Exit codes
//   0 - no drift
//   1 - drift OR script error

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SERVICES_DIR = path.join(ROOT, 'packages/core/services')
const TENANT_MIGRATIONS = path.join(ROOT, 'supabase/migrations')
const CONTROL_PLANE_MIGRATIONS = path.join(ROOT, 'supabase-control-plane/migrations')

// ── SQL function-signature parser ───────────────────────────────────────

/**
 * Strip SQL line comments (`-- ...`) and block comments. Keeps strings
 * intact so 'p_status text default ''pending''' still parses correctly.
 */
export function stripSqlComments(sql) {
  let out = ''
  let i = 0
  let inString = false
  let stringChar = null
  while (i < sql.length) {
    const ch = sql[i]
    if (inString) {
      out += ch
      if (ch === stringChar) { inString = false; stringChar = null }
      i += 1
      continue
    }
    if (ch === "'" || ch === '"') {
      inString = true
      stringChar = ch
      out += ch
      i += 1
      continue
    }
    const two = sql.slice(i, i + 2)
    // Line comment: drop everything until newline.
    if (two === '--') {
      while (i < sql.length && sql[i] !== '\n') i += 1
      continue
    }
    // Block comment.
    if (two === '/*') {
      i += 2
      while (i < sql.length - 1 && sql.slice(i, i + 2) !== '*/') i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/**
 * Find the matching close paren for the open at `start`. Returns the
 * index of the close paren, or -1 if unbalanced. Handles nested parens.
 * NOTE: ignores string-literal boundaries — fine for our use because
 * SQL parameter declarations don't put unescaped `(`/`)` inside string
 * literals in practice. Defaults like `'pending'` are safe.
 */
function matchClosingParen(text, start) {
  let depth = 0
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Split a parameter list on top-level commas (depth-aware so default
 * expressions like `coalesce(a, b)` don't get split).
 */
function splitParams(paramText) {
  const out = []
  let depth = 0
  let current = ''
  let inString = false
  let stringChar = null
  for (const ch of paramText) {
    if (inString) {
      current += ch
      if (ch === stringChar) {
        inString = false
        stringChar = null
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      inString = true
      stringChar = ch
      current += ch
      continue
    }
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
 * Given the contents of a single SQL migration file, find every
 * `create or replace function public.NAME(...)` declaration and return
 * `{ name, params: Set<string> }[]`.
 */
export function parseSqlFunctions(sql) {
  const stripped = stripSqlComments(sql)
  const result = []
  // Case-insensitive, allow whitespace between keywords.
  const FN_HEAD = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi
  let m
  while ((m = FN_HEAD.exec(stripped)) !== null) {
    const name = m[1]
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchClosingParen(stripped, openIdx)
    if (closeIdx === -1) continue
    const paramText = stripped.slice(openIdx + 1, closeIdx)
    const params = new Set()
    for (const segment of splitParams(paramText)) {
      const trimmed = segment.trim()
      if (!trimmed) continue
      // The first whitespace-separated token is the parameter name.
      // Skip optional IN/OUT/INOUT/VARIADIC mode markers.
      const tokens = trimmed.split(/\s+/)
      let idx = 0
      const modeKeywords = new Set(['in', 'out', 'inout', 'variadic'])
      while (idx < tokens.length && modeKeywords.has(tokens[idx].toLowerCase())) idx += 1
      if (idx >= tokens.length) continue
      const paramName = tokens[idx].toLowerCase()
      // Sanity-check the name is an identifier.
      if (/^[a-z_][a-z0-9_]*$/.test(paramName)) params.add(paramName)
    }
    result.push({ name, params })
  }
  return result
}

// ── Build the (function name -> params) map across all migrations ───────

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => path.join(dir, f))
    .sort() // chronological — filenames are date-prefixed
}

function buildFunctionRegistry() {
  const registry = new Map()  // name -> { params, file }
  const allFiles = [
    ...listSqlFiles(TENANT_MIGRATIONS),
    ...listSqlFiles(CONTROL_PLANE_MIGRATIONS),
  ]
  for (const file of allFiles) {
    const sql = fs.readFileSync(file, 'utf8')
    const fns = parseSqlFunctions(sql)
    for (const fn of fns) {
      // Later definitions win (chronological replay).
      registry.set(fn.name, { params: fn.params, file })
    }
  }
  return registry
}

// ── JS .rpc() call parser ───────────────────────────────────────────────

/**
 * Walk a JS source string and find every `.rpc('name', secondArg)`. For
 * each one, attempt to extract the keys of an inline object literal in
 * `secondArg`. If the second arg is not an inline object (or is missing
 * entirely), record { name, args: null } so the caller can mark it as
 * "skipped - dynamic args" or "no args".
 *
 * The parser is intentionally simple but depth-aware: it handles nested
 * objects, arrays, and string literals.
 */
export function parseJsRpcCalls(source) {
  const calls = []
  // Find the start of every `.rpc(` token.
  const callStartRe = /\.rpc\s*\(\s*(['"])([a-z_][a-z0-9_]*)\1\s*(\)|,)/g
  let m
  while ((m = callStartRe.exec(source)) !== null) {
    const name = m[2]
    const closingChar = m[3]
    if (closingChar === ')') {
      // Zero-arg form: rpc('name')
      calls.push({ name, args: new Set(), inline: true })
      continue
    }
    // m.index is the position of the dot. We need to skip ahead to the
    // start of the second-arg expression (just past the comma).
    const argStart = m.index + m[0].length  // points to char after the ','
    // Scan past whitespace to see if it's an object literal `{`.
    let i = argStart
    while (i < source.length && /\s/.test(source[i])) i += 1
    if (source[i] !== '{') {
      // Dynamic — variable or function call. Record but skip key extraction.
      calls.push({ name, args: null, inline: false })
      continue
    }
    // Find the matching `}`.
    let depth = 0
    let end = -1
    let inString = false
    let stringChar = null
    for (let j = i; j < source.length; j += 1) {
      const ch = source[j]
      if (inString) {
        if (ch === '\\') { j += 1; continue }
        if (ch === stringChar) { inString = false; stringChar = null }
        continue
      }
      if (ch === '`' || ch === "'" || ch === '"') {
        inString = true
        stringChar = ch
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) { end = j; break }
      }
    }
    if (end === -1) {
      calls.push({ name, args: null, inline: false })
      continue
    }
    const objectBody = source.slice(i + 1, end)
    const args = extractObjectKeys(objectBody)
    calls.push({ name, args, inline: true })
  }
  return calls
}

/**
 * Given the body of an object literal (without the outer braces),
 * return the Set of top-level keys. Handles:
 *   - bare identifier keys (`p_slot: value`)
 *   - quoted string keys (`'p_slot': value`)
 *   - shorthand (`p_slot,` — key === value)
 * Skips spread (`...payload`) and computed (`[key]:`) — those return null.
 */
function extractObjectKeys(body) {
  const keys = new Set()
  let depth = 0
  let inString = false
  let stringChar = null
  let i = 0
  let segmentStart = 0
  const segments = []
  while (i < body.length) {
    const ch = body[i]
    if (inString) {
      if (ch === '\\') { i += 2; continue }
      if (ch === stringChar) { inString = false; stringChar = null }
      i += 1; continue
    }
    if (ch === '`' || ch === "'" || ch === '"') { inString = true; stringChar = ch; i += 1; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1
    if (ch === ',' && depth === 0) {
      segments.push(body.slice(segmentStart, i))
      segmentStart = i + 1
    }
    i += 1
  }
  segments.push(body.slice(segmentStart))

  for (const raw of segments) {
    const seg = raw.trim()
    if (!seg) continue
    if (seg.startsWith('...')) return null  // spread — give up
    if (seg.startsWith('[')) return null    // computed key — give up
    let keyText
    if (seg.startsWith("'") || seg.startsWith('"')) {
      const quote = seg[0]
      const close = seg.indexOf(quote, 1)
      if (close === -1) continue
      keyText = seg.slice(1, close)
    } else {
      const colonIdx = seg.indexOf(':')
      keyText = (colonIdx === -1 ? seg : seg.slice(0, colonIdx)).trim()
    }
    if (/^[a-z_][a-z0-9_]*$/i.test(keyText)) keys.add(keyText)
  }
  return keys
}

// ── Main ────────────────────────────────────────────────────────────────

function listServiceFiles() {
  if (!fs.existsSync(SERVICES_DIR)) return []
  return fs.readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(SERVICES_DIR, f))
}

function main() {
  const registry = buildFunctionRegistry()
  const drift = []
  const skipped = []
  let calls = 0

  for (const file of listServiceFiles()) {
    const src = fs.readFileSync(file, 'utf8')
    const rpcCalls = parseJsRpcCalls(src)
    for (const call of rpcCalls) {
      calls += 1
      const def = registry.get(call.name)
      if (!def) {
        drift.push({ kind: 'unknown_function', file, name: call.name })
        continue
      }
      if (call.args === null) {
        skipped.push({ file, name: call.name, reason: 'dynamic_args' })
        continue
      }
      for (const arg of call.args) {
        if (!def.params.has(arg.toLowerCase())) {
          drift.push({ kind: 'unknown_arg', file, name: call.name, arg, definedIn: def.file })
        }
      }
    }
  }

  const lines = []
  lines.push('── RPC signature audit ──')
  lines.push(`RPC calls scanned:    ${calls}`)
  lines.push(`Functions registered: ${registry.size}`)
  lines.push(`Skipped (dynamic):    ${skipped.length}`)
  lines.push('')

  if (skipped.length) {
    for (const s of skipped) {
      lines.push(`  ⓘ skipped ${s.name} in ${path.relative(ROOT, s.file)} — dynamic args, not statically auditable`)
    }
    lines.push('')
  }

  if (drift.length === 0) {
    lines.push('✅ No drift found.')
    console.log(lines.join('\n'))
    process.exit(0)
  }

  lines.push(`❌ ${drift.length} drift item(s) found:`)
  lines.push('')
  for (const item of drift) {
    if (item.kind === 'unknown_function') {
      lines.push(`  • UNKNOWN FUNCTION ${item.name}  (called in ${path.relative(ROOT, item.file)})`)
    } else {
      lines.push(`  • UNKNOWN ARG      ${item.name}.${item.arg}  (call in ${path.relative(ROOT, item.file)}; def in ${path.relative(ROOT, item.definedIn)})`)
    }
  }
  console.error(lines.join('\n'))
  process.exit(1)
}

// Only run when invoked directly, not when imported by the test file.
const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) main()
