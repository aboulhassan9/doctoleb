/**
 * medicationAutoInsert.test.mjs
 *
 * Slice 8 acceptance tests for medication autocomplete + auto-insert.
 *
 * AT-8.1 — Typing 'amox' shows seeded rows (search service contract)
 * AT-8.2 — Selecting fills dosage form (search returns dosage_forms)
 * AT-8.3 — Duplicate-case insert produces ONE row (RPC dedup)
 * AT-8.4 — Whitespace-only name skipped (validation guard)
 *
 * These tests validate the service-layer contracts that back the UI
 * interactions. They do NOT test React components — they test the
 * medicationCatalogService.search() and .upsertIfMissing() flows.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { medicationCatalogService } from '../../../packages/core/services/medicationCatalog.js';

// ── AT-8.1: Search returns matching rows ─────────────────────────

describe('AT-8.1 — medicationCatalogService.search shows matching rows', () => {
  let mock;

  afterEach(() => {
    __setSupabaseClientForTest(null);
  });

  it('search("amox") returns seeded Amoxicillin rows from the catalog', async () => {
    mock = createSupabaseMock();
    mock.onFrom('medication_catalog', () => ({
      data: [
        { id: 'med-1', name: 'Amoxicillin', generic_name: null, dosage_forms: ['500mg', '250mg'], common_dosages: ['500mg TID'], notes: null },
        { id: 'med-2', name: 'Amoxicillin/Clavulanate', generic_name: 'Augmentin', dosage_forms: ['625mg', '1g'], common_dosages: ['625mg BID'], notes: null },
      ],
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.search('amox');
    assert.equal(error, null);
    assert.equal(data.length, 2);
    assert.equal(data[0].name, 'Amoxicillin');
    assert.equal(data[1].name, 'Amoxicillin/Clavulanate');
  });

  it('search with < 2 chars returns empty without a DB call', async () => {
    mock = createSupabaseMock();
    let dbCalled = false;
    mock.onFrom('medication_catalog', () => {
      dbCalled = true;
      return { data: [], error: null };
    });
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.search('a');
    assert.equal(error, null);
    assert.deepEqual(data, []);
    assert.equal(dbCalled, false, 'Should not call the DB for queries < 2 chars');
  });

  it('search with empty string returns empty without a DB call', async () => {
    mock = createSupabaseMock();
    let dbCalled = false;
    mock.onFrom('medication_catalog', () => {
      dbCalled = true;
      return { data: [], error: null };
    });
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.search('');
    assert.equal(error, null);
    assert.deepEqual(data, []);
    assert.equal(dbCalled, false);
  });

  it('search uses ilike prefix matching', async () => {
    mock = createSupabaseMock();
    let capturedModifiers = [];
    mock.onFrom('medication_catalog', ({ callEntry }) => {
      capturedModifiers = callEntry.modifiers;
      return { data: [], error: null };
    });
    __setSupabaseClientForTest(mock.client);

    await medicationCatalogService.search('amox');

    // Verify ilike modifier was used with prefix pattern
    const ilikeCall = capturedModifiers.find(m => m.method === 'ilike');
    assert.ok(ilikeCall, 'Must use ilike for search');
    assert.equal(ilikeCall.args[0], 'name');
    assert.equal(ilikeCall.args[1], 'amox%', 'Must use prefix pattern');
  });

  it('search respects the limit parameter', async () => {
    mock = createSupabaseMock();
    let capturedModifiers = [];
    mock.onFrom('medication_catalog', ({ callEntry }) => {
      capturedModifiers = callEntry.modifiers;
      return { data: [], error: null };
    });
    __setSupabaseClientForTest(mock.client);

    await medicationCatalogService.search('asp', { limit: 5 });

    const limitCall = capturedModifiers.find(m => m.method === 'limit');
    assert.ok(limitCall, 'Must use limit');
    assert.equal(limitCall.args[0], 5);
  });
});

// ── AT-8.2: Search results include dosage_forms for prefill ──────

describe('AT-8.2 — Search results include dosage_forms for UI prefill', () => {
  let mock;

  afterEach(() => {
    __setSupabaseClientForTest(null);
  });

  it('search result contains dosage_forms array for each medication', async () => {
    mock = createSupabaseMock();
    mock.onFrom('medication_catalog', () => ({
      data: [
        { id: 'med-1', name: 'Aspirin', generic_name: null, dosage_forms: ['100mg', '300mg'], common_dosages: ['100mg OD'], notes: null },
      ],
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.search('asp');
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.ok(Array.isArray(data[0].dosage_forms), 'dosage_forms must be an array');
    assert.equal(data[0].dosage_forms[0], '100mg', 'First dosage form should be available for prefill');
  });

  it('search result with empty dosage_forms returns empty array', async () => {
    mock = createSupabaseMock();
    mock.onFrom('medication_catalog', () => ({
      data: [
        { id: 'med-3', name: 'New Med', generic_name: null, dosage_forms: [], common_dosages: [], notes: null },
      ],
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    const { data } = await medicationCatalogService.search('new');
    assert.ok(Array.isArray(data[0].dosage_forms));
    assert.equal(data[0].dosage_forms.length, 0);
  });
});

// ── AT-8.3: Duplicate-case insert produces ONE row ───────────────

describe('AT-8.3 — upsertIfMissing deduplicates case-insensitively via RPC', () => {
  let mock;

  afterEach(() => {
    __setSupabaseClientForTest(null);
  });

  it('upsertIfMissing calls the RPC with trimmed name', async () => {
    mock = createSupabaseMock();
    mock.onRpc('upsert_medication_catalog_entry', (args) => ({
      data: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.upsertIfMissing('Aspirin');
    assert.equal(error, null);
    assert.equal(data, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    // Verify RPC was called with correct arguments
    assert.equal(mock.calls.rpc.length, 1);
    assert.equal(mock.calls.rpc[0].name, 'upsert_medication_catalog_entry');
    assert.equal(mock.calls.rpc[0].args.p_name, 'Aspirin');
  });

  it('upsertIfMissing trims whitespace before sending to RPC', async () => {
    mock = createSupabaseMock();
    mock.onRpc('upsert_medication_catalog_entry', (args) => ({
      data: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    await medicationCatalogService.upsertIfMissing('  Aspirin  ');
    assert.equal(mock.calls.rpc[0].args.p_name, 'Aspirin');
  });

  it('two upserts with different cases both resolve (RPC handles dedup)', async () => {
    mock = createSupabaseMock();
    const returnedId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    mock.onRpc('upsert_medication_catalog_entry', () => ({
      data: returnedId,
      error: null,
    }));
    __setSupabaseClientForTest(mock.client);

    const [r1, r2] = await Promise.all([
      medicationCatalogService.upsertIfMissing('Aspirin'),
      medicationCatalogService.upsertIfMissing('aspirin'),
    ]);

    // Both should succeed and return the same canonical ID
    assert.equal(r1.data, returnedId);
    assert.equal(r2.data, returnedId);
    assert.equal(r1.error, null);
    assert.equal(r2.error, null);

    // Both RPC calls were made (the DB-level dedup ensures one row)
    assert.equal(mock.calls.rpc.length, 2);
  });
});

// ── AT-8.4: Whitespace-only name skipped ─────────────────────────

describe('AT-8.4 — upsertIfMissing rejects whitespace-only names', () => {
  let mock;

  afterEach(() => {
    __setSupabaseClientForTest(null);
  });

  it('rejects empty string', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.upsertIfMissing('');
    assert.ok(error, 'Should return an error for empty string');
    assert.equal(data, null);
    assert.equal(mock.calls.rpc.length, 0, 'Should NOT call the RPC');
  });

  it('rejects whitespace-only string', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.upsertIfMissing('   ');
    assert.ok(error, 'Should return an error for whitespace-only string');
    assert.equal(data, null);
    assert.equal(mock.calls.rpc.length, 0, 'Should NOT call the RPC');
  });

  it('rejects null', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.upsertIfMissing(null);
    assert.ok(error, 'Should return an error for null');
    assert.equal(data, null);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('rejects undefined', async () => {
    mock = createSupabaseMock();
    __setSupabaseClientForTest(mock.client);

    const { data, error } = await medicationCatalogService.upsertIfMissing(undefined);
    assert.ok(error, 'Should return an error for undefined');
    assert.equal(data, null);
    assert.equal(mock.calls.rpc.length, 0);
  });
});
