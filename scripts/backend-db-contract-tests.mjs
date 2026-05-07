import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const LIVE_PROJECT_REF = 'gezmfmskhmjgnquoyosq';
const root = process.cwd();

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

for (const envFile of ['.env.test.local', '.env.local', '.env']) {
  loadDotEnvFile(path.join(root, envFile));
}

const env = process.env;
const testUrl = env.BACKEND_TEST_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = env.BACKEND_TEST_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const databaseUrl = env.BACKEND_TEST_DATABASE_URL;
const allowLive = env.BACKEND_TEST_ALLOW_LIVE === 'true';

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
}

function skip(name, detail) {
  record(name, true, `SKIP: ${detail}`);
}

function fail(name, detail) {
  record(name, false, detail);
}

function isExpectedForbidden(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('not allowed') ||
    message.includes('jwt') ||
    message.includes('schema cache') ||
    message.includes('could not find the function')
  );
}

function isTransientRpcError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callRpcWithRetry(client, name, args = {}) {
  const delays = [250, 750, 1500];
  let result;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    result = await client.rpc(name, args);
    if (!result.error || !isTransientRpcError(result.error) || attempt === delays.length) {
      return result;
    }
    await sleep(delays[attempt]);
  }

  return result;
}

function assertNotLive(url) {
  if (allowLive) return;
  if (url?.includes(LIVE_PROJECT_REF)) {
    throw new Error(
      `Refusing to run backend DB contract tests against live project ${LIVE_PROJECT_REF}. ` +
      'Use a Supabase branch/local URL or set BACKEND_TEST_ALLOW_LIVE=true only for read-only diagnostics.'
    );
  }
}

function runSqlAuditIfConfigured() {
  if (!databaseUrl) {
    skip('DB introspection SQL audit', 'BACKEND_TEST_DATABASE_URL is not set.');
    return;
  }

  assertNotLive(databaseUrl);

  const auditFile = path.join(root, 'supabase', 'sql', 'backend_contract_audit.sql');
  if (!fs.existsSync(auditFile)) {
    fail('DB introspection SQL audit', 'supabase/sql/backend_contract_audit.sql is missing.');
    return;
  }

  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', auditFile], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.error) {
    skip('DB introspection SQL audit', `psql is not available: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    fail('DB introspection SQL audit', result.stderr || result.stdout || 'psql failed.');
    return;
  }

  record('DB introspection SQL audit', true, 'backend_contract_audit.sql executed.');
}

function runPgTapRlsSuiteIfConfigured() {
  if (!databaseUrl) {
    skip('pgTAP RLS contract suite', 'BACKEND_TEST_DATABASE_URL is not set.');
    return;
  }

  assertNotLive(databaseUrl);

  const testFile = path.join(root, 'supabase', 'tests', 'pgtap_rls.sql');
  if (!fs.existsSync(testFile)) {
    fail('pgTAP RLS contract suite', 'supabase/tests/pgtap_rls.sql is missing.');
    return;
  }

  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', testFile], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.error) {
    skip('pgTAP RLS contract suite', `psql is not available: ${result.error.message}`);
    return;
  }

  if (result.status !== 0) {
    fail('pgTAP RLS contract suite', result.stderr || result.stdout || 'psql failed.');
    return;
  }

  record('pgTAP RLS contract suite', true, 'supabase/tests/pgtap_rls.sql executed.');
}

async function expectRpcAllowed(client, name, args = {}) {
  const { error } = await callRpcWithRetry(client, name, args);
  if (error) {
    fail(`anon RPC ${name} allowed`, error.message || 'Unexpected error.');
    return;
  }
  record(`anon RPC ${name} allowed`, true);
}

async function expectRpcForbidden(client, name, args = {}) {
  const { error } = await callRpcWithRetry(client, name, args);
  if (!error) {
    fail(`anon RPC ${name} forbidden`, 'RPC succeeded but should not be callable by anon.');
    return;
  }
  if (!isExpectedForbidden(error)) {
    fail(`anon RPC ${name} forbidden`, error.message || 'Unexpected non-forbidden error.');
    return;
  }
  record(`anon RPC ${name} forbidden`, true);
}

async function runAnonRpcExposureTests() {
  if (!testUrl || !anonKey) {
    skip('Anon RPC exposure tests', 'BACKEND_TEST_SUPABASE_URL or BACKEND_TEST_SUPABASE_ANON_KEY is not set.');
    return;
  }

  assertNotLive(testUrl);

  const client = createClient(testUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await expectRpcAllowed(client, 'get_public_tenant_app_config');

  const randomId = '00000000-0000-4000-8000-000000000001';

  await expectRpcForbidden(client, 'book_slot', {
    p_slot: randomId,
    p_patient: randomId,
    p_booked_by: randomId,
    p_status: 'scheduled',
    p_reason: 'contract test',
    p_duration_minutes: 30,
    p_visit_type: null,
  });
  await expectRpcForbidden(client, 'start_encounter', {
    p_appointment: randomId,
    p_chief_complaint: 'contract test',
  });
  await expectRpcForbidden(client, 'complete_encounter', {
    p_encounter: randomId,
    p_summary: 'contract test',
  });
  await expectRpcForbidden(client, 'finalize_clinical_document', {
    p_document: randomId,
  });
  await expectRpcForbidden(client, 'void_clinical_document', {
    p_document: randomId,
    p_reason: 'contract test',
  });

  for (const triggerOnlyFunction of [
    'enforce_message_redaction',
    'enforce_prescription_requires_diagnosis',
    'enforce_tier2_status_transition',
    'normalize_encounter_from_appointment',
    'normalize_medical_intake_workflow',
    'prevent_appointment_identity_mutation',
    'prevent_system_catalog_mutation',
    'propagate_medical_intake_status',
  ]) {
    await expectRpcForbidden(client, triggerOnlyFunction);
  }
}

function printAndExit() {
  console.log('\nBackend DB Contract Tests');
  console.log('=========================\n');

  for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}`);
    if (result.detail) console.log(`  - ${result.detail}`);
  }

  const failures = results.filter((result) => !result.passed);
  if (failures.length) {
    console.error(`\n${failures.length} backend DB contract test(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll configured backend DB contract tests passed.');
}

try {
  runSqlAuditIfConfigured();
  runPgTapRlsSuiteIfConfigured();
  await runAnonRpcExposureTests();
} catch (error) {
  fail('Backend DB contract test preflight', error.message || 'Unexpected test harness failure.');
}

printAndExit();
