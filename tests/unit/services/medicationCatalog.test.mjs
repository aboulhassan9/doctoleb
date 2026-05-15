import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { medicationCatalogService } from '../../../packages/core/services/medicationCatalog.js';

const CATALOG_ID   = '11111111-1111-4111-8111-111111111111';
const ARCHIVED_BY  = '22222222-2222-4222-8222-222222222222';

const AMOXICILLIN_ROW = {
  id: CATALOG_ID,
  name: 'Amoxicillin',
  generic_name: 'Amoxicillin',
  dosage_forms: ['tablet', 'capsule', 'suspension'],
  common_dosages: ['250mg', '500mg'],
  notes: null,
  is_archived: false,
  archived_at: null,
  archived_by: null,
  created_at: '2026-05-15T09:00:00Z',
  updated_at: '2026-05-15T09:00:00Z',
};

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

// --- AT-2.2: search modifiers ---
describe('medicationCatalogService.search (AT-2.2)', () => {
  it('returns [] without a DB call when query is empty', async () => {
    const result = await medicationCatalogService.search('');
    assert.deepEqual(result.data, []);
    assert.equal(result.error, null);
    assert.equal(mock.calls.from.length, 0, 'No DB call for empty query');
  });

  it('returns [] without a DB call when query is whitespace-only', async () => {
    const result = await medicationCatalogService.search('  ');
    assert.deepEqual(result.data, []);
    assert.equal(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('returns [] without a DB call when query is a single character', async () => {
    const result = await medicationCatalogService.search('a');
    assert.deepEqual(result.data, []);
    assert.equal(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('issues an ilike query for a 2+ char search', async () => {
    mock.onFrom('medication_catalog', () => ({ data: [AMOXICILLIN_ROW], error: null }));
    const result = await medicationCatalogService.search('amo');
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, 'Amoxicillin');

    // Assert the ilike modifier was used with the right column.
    const calls = mock.calls.from.filter((c) => c.table === 'medication_catalog');
    assert.equal(calls.length, 1);
    assert.ok(
      calls[0].modifiers.some((m) => m.method === 'ilike' && m.args[0] === 'name'),
      'ilike modifier on name column'
    );
    // Assert is_archived filter is applied.
    assert.ok(
      calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'is_archived'),
      'is_archived filter applied'
    );
    // Assert limit modifier is applied.
    assert.ok(
      calls[0].modifiers.some((m) => m.method === 'limit'),
      'limit modifier applied'
    );
  });

  it('surfaces a DB error', async () => {
    mock.onFrom('medication_catalog', () => ({
      data: null,
      error: { message: 'connection failed' },
    }));
    const result = await medicationCatalogService.search('amox');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });
});

// --- AT-2.3: upsertIfMissing RPC arg shape ---
describe('medicationCatalogService.upsertIfMissing (AT-2.3)', () => {
  it('rejects a whitespace-only name without calling the RPC', async () => {
    const result = await medicationCatalogService.upsertIfMissing('   ');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0, 'No RPC call for whitespace name');
  });

  it('rejects an empty string without calling the RPC', async () => {
    const result = await medicationCatalogService.upsertIfMissing('');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('rejects null without calling the RPC', async () => {
    const result = await medicationCatalogService.upsertIfMissing(null);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('calls the RPC with trimmed p_name and returns the UUID', async () => {
    mock.onRpc('upsert_medication_catalog_entry', () => ({
      data: CATALOG_ID,
      error: null,
    }));
    const result = await medicationCatalogService.upsertIfMissing('  Amoxicillin  ');
    assert.equal(result.error, null);
    assert.equal(result.data, CATALOG_ID);

    // Assert RPC was called with the right args.
    assert.equal(mock.calls.rpc.length, 1);
    assert.equal(mock.calls.rpc[0].name, 'upsert_medication_catalog_entry');
    assert.equal(mock.calls.rpc[0].args.p_name, 'Amoxicillin');
  });

  it('surfaces an RPC error', async () => {
    mock.onRpc('upsert_medication_catalog_entry', () => ({
      data: null,
      error: { message: 'RPC failed' },
    }));
    const result = await medicationCatalogService.upsertIfMissing('Aspirin');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });
});

describe('medicationCatalogService.getById', () => {
  it('rejects a missing ID', async () => {
    const result = await medicationCatalogService.getById(null);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('fetches a row by ID', async () => {
    mock.onFrom('medication_catalog', () => ({ data: AMOXICILLIN_ROW, error: null }));
    const result = await medicationCatalogService.getById(CATALOG_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.id, CATALOG_ID);
  });
});

describe('medicationCatalogService.create', () => {
  it('rejects a missing name', async () => {
    const result = await medicationCatalogService.create({ generic_name: 'Test' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('creates a valid entry', async () => {
    mock.onFrom('medication_catalog', () => ({ data: AMOXICILLIN_ROW, error: null }));
    const result = await medicationCatalogService.create({
      name: 'Amoxicillin',
      generic_name: 'Amoxicillin',
      dosage_forms: ['tablet', 'capsule'],
    });
    assert.equal(result.error, null);
    assert.equal(result.data.name, 'Amoxicillin');
  });
});

describe('medicationCatalogService.archive', () => {
  it('rejects a missing ID', async () => {
    const result = await medicationCatalogService.archive(null, ARCHIVED_BY);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('rejects a missing archivedBy', async () => {
    const result = await medicationCatalogService.archive(CATALOG_ID, null);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('archives an entry', async () => {
    const archived = { ...AMOXICILLIN_ROW, is_archived: true, archived_by: ARCHIVED_BY };
    mock.onFrom('medication_catalog', () => ({ data: archived, error: null }));
    const result = await medicationCatalogService.archive(CATALOG_ID, ARCHIVED_BY);
    assert.equal(result.error, null);
    assert.equal(result.data.is_archived, true);
  });
});
