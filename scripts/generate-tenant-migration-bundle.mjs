import fs from 'node:fs';
import {
  readTenantMigrationRows,
  renderTenantMigrationBundle,
  tenantMigrationBundlePath,
} from './lib/tenantMigrationFlow.mjs';

const repoRoot = process.cwd();
const outputPath = tenantMigrationBundlePath(repoRoot);
const checkMode = process.argv.includes('--check');

const output = renderTenantMigrationBundle(readTenantMigrationRows(repoRoot));

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
