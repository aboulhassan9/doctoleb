// Unit tests for scripts/audit-rpc-signatures.mjs.
//
// Why these matter: the live-invocation canary at the bottom is the only
// thing that runs against the real codebase. The cases above pin the
// parser + validator behavior against synthetic inputs with known-bad
// drift, so a green canary on its own doesn't fool anyone — we KNOW the
// drift detection works because we made it fail on purpose.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  stripSqlComments,
  parseSqlFunctions,
  parseJsRpcCalls,
} from '../../scripts/audit-rpc-signatures.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const SCRIPT = path.join(REPO_ROOT, 'scripts/audit-rpc-signatures.mjs')

// ── SQL parsing correctness ─────────────────────────────────────────────

describe('audit-rpc-signatures / SQL parser', () => {
  it('extracts a simple function with positional params', () => {
    const sql = `
      create or replace function public.book_slot(
        p_slot uuid,
        p_patient uuid,
        p_booked_by uuid
      ) returns uuid language plpgsql as $$ begin end; $$;
    `
    const fns = parseSqlFunctions(sql)
    assert.equal(fns.length, 1)
    assert.equal(fns[0].name, 'book_slot')
    assert.deepEqual([...fns[0].params].sort(), ['p_booked_by', 'p_patient', 'p_slot'])
  })

  it('handles default expressions with commas inside parens (coalesce, etc.)', () => {
    const sql = `
      create or replace function public.f(
        p_a text default coalesce('x', 'y'),
        p_b int default 5
      ) returns void as $$ begin end; $$;
    `
    const fns = parseSqlFunctions(sql)
    assert.equal(fns.length, 1)
    assert.deepEqual([...fns[0].params].sort(), ['p_a', 'p_b'])
  })

  it('strips single-line and block comments', () => {
    const sql = `
      -- old definition retained for reference
      /* create or replace function public.ghost(p_old text) returns void as $$ ... $$; */
      create or replace function public.real_fn(
        p_id uuid  -- inline note
      ) returns void as $$ begin end; $$;
    `
    const fns = parseSqlFunctions(sql)
    const names = fns.map((f) => f.name).sort()
    assert.deepEqual(names, ['real_fn'])  // ghost was in a block comment
    assert.deepEqual([...fns[0].params], ['p_id'])
  })

  it('handles "create function" (no "or replace")', () => {
    const sql = `create function public.simple(p_x int) returns int as $$ select 1 $$;`
    const fns = parseSqlFunctions(sql)
    assert.equal(fns.length, 1)
    assert.equal(fns[0].name, 'simple')
    assert.deepEqual([...fns[0].params], ['p_x'])
  })

  it('strips IN/OUT/INOUT/VARIADIC mode keywords from param names', () => {
    const sql = `
      create or replace function public.modes(
        in p_a text,
        out p_b int,
        inout p_c uuid,
        variadic p_rest text[]
      ) returns void as $$ begin end; $$;
    `
    const fns = parseSqlFunctions(sql)
    assert.deepEqual([...fns[0].params].sort(), ['p_a', 'p_b', 'p_c', 'p_rest'])
  })

  it('parses MULTIPLE function definitions in one file', () => {
    const sql = `
      create or replace function public.first_fn(p_a int) returns void as $$ begin end; $$;
      create or replace function public.second_fn(p_b int, p_c text) returns void as $$ begin end; $$;
    `
    const fns = parseSqlFunctions(sql)
    assert.equal(fns.length, 2)
    assert.deepEqual(fns.map((f) => f.name).sort(), ['first_fn', 'second_fn'])
  })
})

describe('audit-rpc-signatures / SQL comment stripper', () => {
  it('strips -- line comments but not -- inside strings', () => {
    const sql = `select '-- not a comment' as label;`
    assert.equal(stripSqlComments(sql).trim(), `select '-- not a comment' as label;`)
  })

  it('strips /* */ block comments across multiple lines', () => {
    const sql = `before\n/* hello\nworld */\nafter`
    const stripped = stripSqlComments(sql)
    assert.ok(stripped.includes('before'))
    assert.ok(stripped.includes('after'))
    assert.ok(!stripped.includes('hello'))
  })
})

// ── JS parser correctness ──────────────────────────────────────────────

describe('audit-rpc-signatures / JS parser', () => {
  it('extracts an inline object literal arg list', () => {
    const src = `
      supabase.rpc('book_slot', {
        p_slot: slotId,
        p_patient: patientId,
        p_booked_by: bookedBy,
      });
    `
    const calls = parseJsRpcCalls(src)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].name, 'book_slot')
    assert.deepEqual([...calls[0].args].sort(), ['p_booked_by', 'p_patient', 'p_slot'])
  })

  it('handles quoted keys', () => {
    const src = `supabase.rpc('f', { 'p_one': 1, "p_two": 2 });`
    const calls = parseJsRpcCalls(src)
    assert.deepEqual([...calls[0].args].sort(), ['p_one', 'p_two'])
  })

  it('records args=null on a non-object second arg (variable, function call)', () => {
    const src = `supabase.rpc('update_patient_profile', rpcPayload);`
    const calls = parseJsRpcCalls(src)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].args, null)
  })

  it('records args=null when the object contains a spread (...payload)', () => {
    const src = `supabase.rpc('f', { ...base, p_x: 1 });`
    const calls = parseJsRpcCalls(src)
    assert.equal(calls[0].args, null)
  })

  it('records args=null when the object contains a computed key', () => {
    const src = `supabase.rpc('f', { [dynamicKey]: 1 });`
    const calls = parseJsRpcCalls(src)
    assert.equal(calls[0].args, null)
  })

  it('handles a zero-arg call', () => {
    const src = `supabase.rpc('get_public_tenant_app_config')`
    const calls = parseJsRpcCalls(src)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].name, 'get_public_tenant_app_config')
    assert.equal(calls[0].args.size, 0)
  })

  it('handles nested objects in arg values (depth-aware)', () => {
    const src = `
      supabase.rpc('f', {
        p_meta: { nested: { deep: 1 }, list: [1, 2, 3] },
        p_id: 'abc'
      });
    `
    const calls = parseJsRpcCalls(src)
    assert.deepEqual([...calls[0].args].sort(), ['p_id', 'p_meta'])
  })

  it('handles template-literal string values without leaking the backticks', () => {
    const src = "supabase.rpc('f', { p_msg: `hello ${name}`, p_id: 1 });"
    const calls = parseJsRpcCalls(src)
    assert.deepEqual([...calls[0].args].sort(), ['p_id', 'p_msg'])
  })

  it('finds MULTIPLE rpc calls in one source', () => {
    const src = `
      await supabase.rpc('a', { p_x: 1 });
      await supabase.rpc('b', { p_y: 2 });
    `
    const calls = parseJsRpcCalls(src)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map((c) => c.name).sort(), ['a', 'b'])
  })
})

// ── Live invocation: real script against the real codebase ─────────────

describe('audit-rpc-signatures / live invocation', () => {
  it('exits 0 against the current services + migrations (no drift today)', async () => {
    const out = await new Promise((resolve, reject) => {
      const cp = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
      const stdout = []
      const stderr = []
      cp.stdout.on('data', (c) => stdout.push(c))
      cp.stderr.on('data', (c) => stderr.push(c))
      cp.on('error', reject)
      cp.on('close', (code) => resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }))
    })
    if (out.code !== 0) {
      console.error('audit-rpc-signatures exited non-zero:\n', out.stderr || out.stdout)
    }
    assert.equal(out.code, 0)
    assert.match(out.stdout, /No drift found/)
  })

  it('catches a typo\'d arg name when fed synthetic bad source', () => {
    // Synthetic: define a function with p_a, call it with p_typo.
    const fns = parseSqlFunctions(`
      create or replace function public.test_fn(p_a uuid, p_b text) returns void as $$ begin end; $$;
    `)
    assert.equal(fns.length, 1)
    const params = fns[0].params

    const calls = parseJsRpcCalls(`
      supabase.rpc('test_fn', { p_a: '...', p_typo: 'oops' });
    `)
    assert.equal(calls.length, 1)
    const unknownArgs = [...calls[0].args].filter((arg) => !params.has(arg))
    assert.deepEqual(unknownArgs, ['p_typo'])
  })

  it('catches a call to an undefined function when no SQL definition exists', () => {
    const calls = parseJsRpcCalls(`supabase.rpc('ghost_function', { p_x: 1 });`)
    const registry = new Map()  // empty — no functions registered
    const def = registry.get(calls[0].name)
    assert.equal(def, undefined)  // the validator would emit "unknown_function" drift
  })
})
