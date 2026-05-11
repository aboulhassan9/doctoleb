import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const outputPath = path.join(
  repoRoot,
  'supabase-control-plane',
  'functions',
  '_shared',
  'tenantMigrationBundle.ts',
);
const checkMode = process.argv.includes('--check');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseMigrationName(fileName) {
  const match = fileName.match(/^([0-9]{8,20})_(.+)\.sql$/);
  if (!match) return null;
  return {
    version: match[1],
    name: match[2],
  };
}

function migrationRows() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => {
      const parsed = parseMigrationName(entry.name);
      if (!parsed) {
        throw new Error(`Invalid migration filename: ${entry.name}`);
      }

      const sql = fs.readFileSync(path.join(migrationsDir, entry.name), 'utf8').replace(/\r\n/g, '\n');
      return {
        ...parsed,
        fileName: entry.name,
        checksum: sha256(sql),
        sql,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function renderBundle(rows) {
  const sourceChecksum = sha256(rows.map((row) => `${row.version}:${row.name}:${row.checksum}`).join('\n'));
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

const output = renderBundle(migrationRows());

if (checkMode) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== output) {
    console.error('Tenant migration bundle is out of date. Run npm run generate:tenant-migration-bundle.');
    process.exit(1);
  }
  console.log('PASS tenant migration bundle is current.');
} else {
  fs.writeFileSync(outputPath, output);
  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
}
