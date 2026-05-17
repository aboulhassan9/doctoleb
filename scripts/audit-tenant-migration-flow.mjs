import {
  auditTenantMigrationFlow,
  tenantMigrationBundlePath,
} from './lib/tenantMigrationFlow.mjs';

const repoRoot = process.cwd();
const skipGitState = process.argv.includes('--skip-git-state');

const result = auditTenantMigrationFlow({
  repoRoot,
  checkGitState: !skipGitState,
});

const first = result.rows[0];
const last = result.rows.at(-1);

console.log('Tenant Migration Flow Audit');
console.log('===========================');
console.log(`Migrations: ${result.rows.length}`);
console.log(`First: ${first ? first.fileName : 'none'}`);
console.log(`Last: ${last ? last.fileName : 'none'}`);
console.log(`Source checksum: ${result.sourceChecksum}`);
console.log(`Bundle: ${tenantMigrationBundlePath(repoRoot)}`);
console.log('');
console.log('CI path:');
console.log('1. Check generated tenant migration bundle.');
console.log('2. Audit this flow for missing/untracked/unsafe migrations.');
console.log('3. Start disposable local Supabase.');
console.log('4. Apply supabase/migrations with supabase db reset --local --no-seed.');
console.log('5. Run DB/RLS/RPC contract tests against that disposable database.');
console.log('6. Deploy only after the same bundle checksum is available to the SaaS runner.');

if (result.warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  for (const warning of result.warnings) {
    console.log(`- ${warning}`);
  }
}

if (result.errors.length > 0) {
  console.error('');
  console.error('Errors:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('');
console.log('PASS tenant migration flow is aligned.');
