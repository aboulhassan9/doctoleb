import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const TENANT_MIGRATION_FILE_PATTERN = /^([0-9]{8,20})_(.+)\.sql$/;

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizeSql(sql) {
  return String(sql ?? '').replace(/\r\n/g, '\n');
}

export function tenantMigrationsDir(repoRoot = process.cwd()) {
  return path.join(repoRoot, 'supabase', 'migrations');
}

export function tenantMigrationBundlePath(repoRoot = process.cwd()) {
  return path.join(
    repoRoot,
    'supabase-control-plane',
    'functions',
    '_shared',
    'tenantMigrationBundle.ts',
  );
}

export function parseMigrationName(fileName) {
  const match = fileName.match(TENANT_MIGRATION_FILE_PATTERN);
  if (!match) return null;
  return {
    version: match[1],
    name: match[2],
  };
}

export function migrationRowsFromFiles(files) {
  return files
    .map(({ fileName, sql }) => {
      const parsed = parseMigrationName(fileName);
      if (!parsed) {
        throw new Error(`Invalid tenant migration filename: ${fileName}`);
      }

      const normalizedSql = normalizeSql(sql);
      return {
        ...parsed,
        fileName,
        checksum: sha256(normalizedSql),
        sql: normalizedSql,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function readTenantMigrationRows(repoRoot = process.cwd()) {
  const migrationsDir = tenantMigrationsDir(repoRoot);
  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => ({
      fileName: entry.name,
      sql: fs.readFileSync(path.join(migrationsDir, entry.name), 'utf8'),
    }));

  return migrationRowsFromFiles(files);
}

export function tenantMigrationSourceChecksum(rows) {
  return sha256(rows.map((row) => `${row.version}:${row.name}:${row.checksum}`).join('\n'));
}

export function renderTenantMigrationBundle(rows) {
  const sourceChecksum = tenantMigrationSourceChecksum(rows);
  const generatedAt = 'generated from supabase/migrations; do not edit by hand';

  return `// ${generatedAt}
// Run: npm run generate:tenant-migration-bundle

export type TenantMigration = {
  readonly version: string
  readonly name: string
  readonly fileName: string
  readonly checksum: string
  readonly sql: string
}

export const TENANT_MIGRATION_SOURCE_CHECKSUM = ${JSON.stringify(sourceChecksum)}

export const TENANT_MIGRATION_BUNDLE = Object.freeze(${JSON.stringify(rows, null, 2)}) satisfies readonly TenantMigration[]
`;
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

export function validateTenantMigrationRows(rows) {
  const errors = [];
  const warnings = [];
  const versions = new Map();
  const names = new Map();

  if (rows.length === 0) {
    errors.push('No tenant migration SQL files were found in supabase/migrations.');
  }

  for (const row of rows) {
    if (versions.has(row.version)) {
      errors.push(`Duplicate tenant migration version ${row.version}: ${versions.get(row.version)} and ${row.fileName}.`);
    }
    versions.set(row.version, row.fileName);

    if (names.has(row.name)) {
      warnings.push(`Repeated tenant migration name "${row.name}": ${names.get(row.name)} and ${row.fileName}.`);
    }
    names.set(row.name, row.fileName);

    if (row.sql.trim().length === 0) {
      errors.push(`Tenant migration ${row.fileName} is empty.`);
    }

    if (/\bcreate\s+index\s+concurrently\b/i.test(row.sql)) {
      errors.push(`Tenant migration ${row.fileName} uses CREATE INDEX CONCURRENTLY, which is unsafe in the transactional SaaS runner path.`);
    }

    const beginCount = countMatches(row.sql, /^\s*begin\s*;/gim);
    const commitCount = countMatches(row.sql, /^\s*commit\s*;/gim);
    if (beginCount !== commitCount) {
      errors.push(`Tenant migration ${row.fileName} has unbalanced explicit transaction markers: begin=${beginCount}, commit=${commitCount}.`);
    }
  }

  return { errors, warnings };
}

function gitLines(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function inspectTenantMigrationGitState(repoRoot = process.cwd()) {
  const untracked = gitLines(repoRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'supabase/migrations/*.sql',
    'supabase-control-plane/migrations/*.sql',
  ]);
  const unstaged = gitLines(repoRoot, [
    'diff',
    '--name-only',
    '--',
    'supabase/migrations',
    'supabase-control-plane/migrations',
    'supabase-control-plane/functions/_shared/tenantMigrationBundle.ts',
  ]);

  return {
    untracked,
    unstaged,
  };
}

export function auditTenantMigrationFlow({
  repoRoot = process.cwd(),
  checkGitState = true,
} = {}) {
  const rows = readTenantMigrationRows(repoRoot);
  const expectedBundle = renderTenantMigrationBundle(rows);
  const outputPath = tenantMigrationBundlePath(repoRoot);
  const currentBundle = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  const { errors, warnings } = validateTenantMigrationRows(rows);

  if (currentBundle !== expectedBundle) {
    errors.push('Tenant migration bundle is not exactly generated from the current supabase/migrations directory.');
  }

  if (checkGitState) {
    const gitState = inspectTenantMigrationGitState(repoRoot);
    if (gitState.untracked.length > 0) {
      errors.push(`Untracked migration SQL files are present and cannot be trusted by CI: ${gitState.untracked.join(', ')}.`);
    }
    if (gitState.unstaged.length > 0) {
      errors.push(`Unstaged tenant migration delivery changes are present; stage or revert them before auditing the deploy path: ${gitState.unstaged.join(', ')}.`);
    }
  }

  return {
    errors,
    warnings,
    rows,
    sourceChecksum: tenantMigrationSourceChecksum(rows),
    outputPath,
  };
}
