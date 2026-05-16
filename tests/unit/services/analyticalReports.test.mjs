/**
 * analyticalReports.test.mjs — service-layer coverage.
 *
 * Verifies the analytical-report service:
 *   - validates inputs before hitting the DB,
 *   - computes a deterministic checksum that matches the canonical JSON,
 *   - resolves report_id → current published version_id when queuing a run,
 *   - short-circuits on a missing current version.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import {
  analyticalReportService,
  createReportDefinitionChecksum,
} from '../../../packages/core/services/analyticalReports.js';

const VALID_DEFINITION = Object.freeze({
  schemaVersion: '1',
  dataSource: 'appointments',
  groupBy: [{ column: 'doctor_id' }],
  aggregations: [{ fn: 'count', as: 'n' }],
  filters: [{ column: 'status', operator: 'eq', value: 'completed' }],
  orderBy: [{ ref: 'n', dir: 'desc' }],
  limit: 20,
  visualization: { type: 'bar' },
  header: { title: 'Completed visits by doctor', showFilters: true },
});

const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('createReportDefinitionChecksum', () => {
  it('returns a 64-char lower-hex SHA-256', async () => {
    const checksum = await createReportDefinitionChecksum(VALID_DEFINITION);
    assert.match(checksum, /^[a-f0-9]{64}$/);
  });

  it('is deterministic across calls', async () => {
    const a = await createReportDefinitionChecksum(VALID_DEFINITION);
    const b = await createReportDefinitionChecksum(VALID_DEFINITION);
    assert.equal(a, b);
  });

  it('is stable against key-order changes (canonical sort)', async () => {
    const reordered = {
      visualization: VALID_DEFINITION.visualization,
      schemaVersion: VALID_DEFINITION.schemaVersion,
      header: VALID_DEFINITION.header,
      dataSource: VALID_DEFINITION.dataSource,
      orderBy: VALID_DEFINITION.orderBy,
      filters: VALID_DEFINITION.filters,
      aggregations: VALID_DEFINITION.aggregations,
      groupBy: VALID_DEFINITION.groupBy,
      limit: VALID_DEFINITION.limit,
    };
    assert.equal(
      await createReportDefinitionChecksum(VALID_DEFINITION),
      await createReportDefinitionChecksum(reordered),
    );
  });
});

describe('analyticalReportService.create', () => {
  it('rejects an invalid category before any DB call', async () => {
    const { data, error } = await analyticalReportService.create({
      name: 'X',
      category: 'random',
      created_by: USER_ID,
    });
    assert.equal(data, null);
    assert.ok(error);
    assert.equal(mock.calls.from.length, 0);
  });

  it('writes a valid create payload through to insert', async () => {
    mock.onFrom('analytical_reports', () => ({
      data: { id: REPORT_ID, name: 'Visits', category: 'clinical_activity' },
      error: null,
    }));
    const { data, error } = await analyticalReportService.create({
      name: 'Visits',
      category: 'clinical_activity',
      created_by: USER_ID,
    });
    assert.equal(error, null);
    assert.equal(data.id, REPORT_ID);
    assert.ok(mock.calls.from.some((c) => c.table === 'analytical_reports'));
  });
});

describe('analyticalReportService.createVersion', () => {
  it('rejects a definition with an unknown data source', async () => {
    const { error } = await analyticalReportService.createVersion({
      report_id: REPORT_ID,
      version_number: 1,
      definition: { ...VALID_DEFINITION, dataSource: 'raw_sql' },
      created_by: USER_ID,
    });
    assert.ok(error);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a caller-provided checksum that does not match the canonical hash', async () => {
    const { error } = await analyticalReportService.createVersion({
      report_id: REPORT_ID,
      version_number: 1,
      definition: VALID_DEFINITION,
      definition_checksum: 'a'.repeat(64),
      created_by: USER_ID,
    });
    assert.ok(error);
    assert.match(error, /checksum/i);
  });

  it('computes the checksum when none is provided and inserts', async () => {
    mock.onFrom('analytical_report_versions', () => ({
      data: { id: VERSION_ID, report_id: REPORT_ID, version_number: 1 },
      error: null,
    }));
    const { data, error } = await analyticalReportService.createVersion({
      report_id: REPORT_ID,
      version_number: 1,
      definition: VALID_DEFINITION,
      created_by: USER_ID,
    });
    assert.equal(error, null);
    assert.equal(data.id, VERSION_ID);
  });
});

describe('analyticalReportService.queueRun', () => {
  it('rejects when both report_id and version_id are supplied', async () => {
    const { error } = await analyticalReportService.queueRun({
      report_id: REPORT_ID,
      version_id: VERSION_ID,
      requested_by: USER_ID,
    });
    assert.ok(error);
  });

  it('looks up the current published version when given a report_id', async () => {
    let lookupCount = 0;
    mock.onFrom('analytical_report_versions', () => {
      lookupCount += 1;
      return {
        data: { id: VERSION_ID, report_id: REPORT_ID },
        error: null,
      };
    });
    mock.onFrom('analytical_report_runs', () => ({
      data: { id: 'run-1', report_id: REPORT_ID, version_id: VERSION_ID, status: 'queued' },
      error: null,
    }));

    const { data, error } = await analyticalReportService.queueRun({
      report_id: REPORT_ID,
      requested_by: USER_ID,
    });

    assert.equal(error, null);
    assert.equal(data.status, 'queued');
    assert.equal(lookupCount, 1);
  });

  it('returns an error when no current published version exists', async () => {
    mock.onFrom('analytical_report_versions', () => ({ data: null, error: null }));

    const { error } = await analyticalReportService.queueRun({
      report_id: REPORT_ID,
      requested_by: USER_ID,
    });

    assert.ok(error);
    assert.match(error, /no current published/i);
  });
});

describe('analyticalReportService.runDefinition', () => {
  it('rejects an invalid definition before calling the RPC', async () => {
    const { error } = await analyticalReportService.runDefinition({
      schemaVersion: '1',
      dataSource: 'raw_sql', // not allowed
      groupBy: [],
      aggregations: [{ fn: 'count', as: 'n' }],
      visualization: { type: 'kpi' },
      header: { title: 'X' },
    });
    assert.ok(error);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('calls run_analytical_report with the validated definition + filter args', async () => {
    mock.onRpc('run_analytical_report', () => ({
      data: [
        { doctor_id: 'd1', visits: 12 },
        { doctor_id: 'd2', visits: 5 },
      ],
      error: null,
    }));

    const { data, error } = await analyticalReportService.runDefinition(VALID_DEFINITION, {});
    assert.equal(error, null);
    assert.deepEqual(data.rows.map((r) => r.visits), [12, 5]);
    assert.equal(mock.calls.rpc[0].name, 'run_analytical_report');
  });

  it('normalizes a single-object RPC result to a one-row array', async () => {
    mock.onRpc('run_analytical_report', () => ({
      data: { total: 99 },
      error: null,
    }));

    const { data } = await analyticalReportService.runDefinition({
      schemaVersion: '1',
      dataSource: 'appointments',
      groupBy: [],
      aggregations: [{ fn: 'count', as: 'total' }],
      visualization: { type: 'kpi' },
      header: { title: 'Total appointments' },
    });
    assert.deepEqual(data.rows, [{ total: 99 }]);
  });

  it('returns the underlying RPC error verbatim', async () => {
    mock.onRpc('run_analytical_report', () => ({
      data: null,
      error: { message: 'permission denied for table payments' },
    }));

    const { error } = await analyticalReportService.runDefinition({
      schemaVersion: '1',
      dataSource: 'payments',
      groupBy: [],
      aggregations: [{ fn: 'sum', column: 'amount', as: 'revenue' }],
      visualization: { type: 'kpi' },
      header: { title: 'Total revenue' },
    });
    assert.match(error, /permission denied/i);
  });
});

describe('analyticalReportService.update', () => {
  it('rejects an empty patch', async () => {
    const { error } = await analyticalReportService.update(REPORT_ID, {});
    assert.ok(error);
    assert.equal(mock.calls.from.length, 0);
  });

  it('only forwards allowlisted metadata fields', async () => {
    let updatePayload = null;
    mock.onFrom('analytical_reports', ({ callEntry }) => {
      const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
      if (updateMod) [updatePayload] = updateMod.args;
      return { data: { id: REPORT_ID, name: 'Renamed' }, error: null };
    });
    await analyticalReportService.update(REPORT_ID, {
      name: 'Renamed',
      is_default: true,            // not allowlisted — must be dropped
      created_by: 'someone-else',  // not allowlisted — must be dropped
    });
    assert.ok(updatePayload, 'an update payload should have been built');
    assert.deepEqual(Object.keys(updatePayload), ['name']);
  });
});

describe('analyticalReportService.publishNewVersion', () => {
  it('requires reportId and publishedBy', async () => {
    assert.match(
      (await analyticalReportService.publishNewVersion(null, {}, { publishedBy: USER_ID })).error,
      /report id/i,
    );
    assert.match(
      (await analyticalReportService.publishNewVersion(REPORT_ID, {})).error,
      /publishedBy/i,
    );
  });

  it('supersedes the current version then inserts version N+1 as published+current', async () => {
    let supersedeSeen = false;
    let insertedVersion = null;

    // One handler answers all four `analytical_report_versions` calls
    // publishNewVersion makes: (1) latest-version lookup, (2) current-version
    // lookup, (3) supersede update, (4) insert of the new version.
    mock.onFrom('analytical_report_versions', ({ callEntry }) => {
      const methods = callEntry.modifiers.map((m) => m.method);

      if (methods.includes('insert')) {
        const insertMod = callEntry.modifiers.find((m) => m.method === 'insert');
        insertedVersion = insertMod.args[0][0];
        return {
          data: { id: VERSION_ID, report_id: REPORT_ID, version_number: 3, status: 'published' },
          error: null,
        };
      }
      if (methods.includes('update')) {
        supersedeSeen = true;
        return { data: null, error: null };
      }
      if (methods.includes('limit')) {
        // latest version_number lookup → highest existing is 2.
        return { data: [{ version_number: 2 }], error: null };
      }
      // current-version lookup → an existing current row to supersede.
      return { data: { id: 'old-version' }, error: null };
    });

    const { data, error } = await analyticalReportService.publishNewVersion(
      REPORT_ID,
      VALID_DEFINITION,
      { publishedBy: USER_ID },
    );

    assert.equal(error, null);
    assert.equal(data.version_number, 3);
    assert.equal(supersedeSeen, true, 'the current version should be superseded first');
    assert.equal(insertedVersion?.status, 'published');
    assert.equal(insertedVersion?.is_current, true);
    assert.equal(insertedVersion?.version_number, 3);
  });
});

describe('analyticalReportService.runByReport', () => {
  it('requires a report id and a requestedBy', async () => {
    assert.match(
      (await analyticalReportService.runByReport(null, {}, { requestedBy: USER_ID })).error,
      /report id/i,
    );
    assert.match(
      (await analyticalReportService.runByReport(REPORT_ID, {})).error,
      /requestedBy/i,
    );
  });

  it('errors when no published current version exists', async () => {
    mock.onFrom('analytical_report_versions', () => ({ data: null, error: null }));
    const { error } = await analyticalReportService.runByReport(
      REPORT_ID,
      {},
      { requestedBy: USER_ID },
    );
    assert.match(error, /no current published/i);
  });

  it('resolves the current version + calls the RPC + writes a succeeded run row', async () => {
    mock.onFrom('analytical_report_versions', () => ({
      data: { id: VERSION_ID, report_id: REPORT_ID, definition: VALID_DEFINITION },
      error: null,
    }));
    mock.onRpc('run_analytical_report', () => ({
      data: [{ doctor_id: 'd1', n: 3 }],
      error: null,
    }));
    mock.onFrom('analytical_report_runs', () => ({ data: { id: 'run-success' }, error: null }));

    const { data, error } = await analyticalReportService.runByReport(
      REPORT_ID,
      {},
      { requestedBy: USER_ID },
    );
    assert.equal(error, null);
    assert.deepEqual(data.rows, [{ doctor_id: 'd1', n: 3 }]);
  });
});
