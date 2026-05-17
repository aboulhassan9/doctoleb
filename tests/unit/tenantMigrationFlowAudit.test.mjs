import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  migrationRowsFromFiles,
  renderTenantMigrationBundle,
  tenantMigrationSourceChecksum,
  validateTenantMigrationRows,
} from '../../scripts/lib/tenantMigrationFlow.mjs';

describe('tenant migration flow audit', () => {
  it('renders a deterministic bundle with normalized SQL checksums', () => {
    const rows = migrationRowsFromFiles([
      { fileName: '20260501000001_second.sql', sql: 'select 2;\r\n' },
      { fileName: '20260501000000_first.sql', sql: 'select 1;\n' },
    ]);

    assert.deepEqual(rows.map((row) => row.fileName), [
      '20260501000000_first.sql',
      '20260501000001_second.sql',
    ]);
    assert.match(renderTenantMigrationBundle(rows), /TENANT_MIGRATION_SOURCE_CHECKSUM/);
    assert.match(tenantMigrationSourceChecksum(rows), /^[a-f0-9]{64}$/);
  });

  it('rejects duplicate versions and unsafe transactional DDL', () => {
    const rows = migrationRowsFromFiles([
      { fileName: '20260501000000_first.sql', sql: 'select 1;\n' },
      { fileName: '20260501000000_second.sql', sql: 'create index concurrently bad_idx on t(id);\n' },
    ]);

    const result = validateTenantMigrationRows(rows);

    assert.match(result.errors.join('\n'), /Duplicate tenant migration version 20260501000000/);
    assert.match(result.errors.join('\n'), /CREATE INDEX CONCURRENTLY/);
  });

  it('allows the existing legacy mix of date and timestamp migration prefixes', () => {
    const rows = migrationRowsFromFiles([
      { fileName: '20240625000000_baseline.sql', sql: 'select 1;\n' },
      { fileName: '20240626_legacy_day_prefix.sql', sql: 'select 2;\n' },
      { fileName: '202605060001_legacy_short_timestamp.sql', sql: 'select 3;\n' },
    ]);

    const result = validateTenantMigrationRows(rows);

    assert.deepEqual(result.errors, []);
  });

  it('rejects unbalanced explicit transaction markers', () => {
    const rows = migrationRowsFromFiles([
      { fileName: '20260501000000_first.sql', sql: 'begin;\nselect 1;\n' },
    ]);

    const result = validateTenantMigrationRows(rows);

    assert.match(result.errors.join('\n'), /unbalanced explicit transaction markers/);
  });
});
