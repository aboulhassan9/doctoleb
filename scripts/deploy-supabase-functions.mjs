import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SUPABASE_CLI_VERSION = process.env.SUPABASE_CLI_VERSION || '2.72.7';
const CONTROL_PLANE_PROJECT_REF = process.env.CONTROL_PLANE_SUPABASE_PROJECT_REF || 'xouqxgwccewvbtkqming';
const TENANT_PROJECT_REF = process.env.TENANT_SUPABASE_PROJECT_REF || '';
const CONTROL_PLANE_PUBLIC_FUNCTIONS = new Set([
  'marketing-capture-lead',
  'tenant-resolve',
]);
const TENANT_PUBLIC_FUNCTIONS = new Set([
  'stripe-patient-webhook',
]);

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing function source directory: ${source}`);
  }
  fs.cpSync(source, target, { recursive: true, force: true });
}

function stageFunctions({ sourceRoot, functionNames }) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doctoleb-supabase-functions-'));
  const stagedFunctionsRoot = path.join(stageRoot, 'supabase', 'functions');
  fs.mkdirSync(stagedFunctionsRoot, { recursive: true });

  const sharedSource = path.join(sourceRoot, '_shared');
  if (fs.existsSync(sharedSource)) {
    copyDirectory(sharedSource, path.join(stagedFunctionsRoot, '_shared'));
  }

  for (const functionName of functionNames) {
    copyDirectory(path.join(sourceRoot, functionName), path.join(stagedFunctionsRoot, functionName));
  }

  const configSource = path.join('supabase', 'config.toml');
  if (fs.existsSync(configSource)) {
    fs.copyFileSync(configSource, path.join(stageRoot, 'supabase', 'config.toml'));
  }

  return stageRoot;
}

function runSupabaseDeploy({ stageRoot, functionName, projectRef }) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    '--yes',
    `supabase@${SUPABASE_CLI_VERSION}`,
    'functions',
    'deploy',
    functionName,
    '--project-ref',
    projectRef,
  ];

  if (CONTROL_PLANE_PUBLIC_FUNCTIONS.has(functionName) || TENANT_PUBLIC_FUNCTIONS.has(functionName)) {
    args.push('--no-verify-jwt');
  }

  const result = spawnSync(command, args, {
    cwd: stageRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Supabase function deploy failed for ${functionName}.`);
  }
}

function assertSupabaseAccessToken() {
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN secret for Supabase function deployment.');
  }
}

function deployGroup({ label, sourceRoot, functionNames, projectRef, projectRefRequired }) {
  if (functionNames.length === 0) {
    console.log(`No ${label} functions selected for deployment.`);
    return;
  }
  if (!projectRef) {
    const message = `Missing project ref for ${label} functions.`;
    if (projectRefRequired) throw new Error(message);
    console.log(`${message} Skipping ${functionNames.length} function(s).`);
    return;
  }

  assertSupabaseAccessToken();
  const stageRoot = stageFunctions({ sourceRoot, functionNames });
  try {
    for (const functionName of functionNames) {
      console.log(`Deploying ${label} function: ${functionName}`);
      runSupabaseDeploy({ stageRoot, functionName, projectRef });
    }
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

const controlPlaneFunctions = parseCsv(process.env.CONTROL_PLANE_FUNCTIONS);
const tenantFunctions = parseCsv(process.env.TENANT_FUNCTIONS);

deployGroup({
  label: 'control-plane',
  sourceRoot: path.join('supabase-control-plane', 'functions'),
  functionNames: controlPlaneFunctions,
  projectRef: CONTROL_PLANE_PROJECT_REF,
  projectRefRequired: true,
});

deployGroup({
  label: 'tenant',
  sourceRoot: path.join('supabase', 'functions'),
  functionNames: tenantFunctions,
  projectRef: TENANT_PROJECT_REF,
  projectRefRequired: true,
});
