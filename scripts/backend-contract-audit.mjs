import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const CHECKS = [];
const WARNINGS = [];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.vite']);

function walk(dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.sql', '.md']) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(absolute, extensions));
      }
      continue;
    }

    if (extensions.includes(path.extname(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function record(kind, passed, message, details = []) {
  const target = kind === 'warning' ? WARNINGS : CHECKS;
  target.push({ passed, message, details });
}

function fail(message, details = []) {
  record('check', false, message, details);
}

function pass(message) {
  record('check', true, message);
}

function warn(message, details = []) {
  record('warning', true, message, details);
}

function findMatches(files, pattern) {
  const matches = [];
  for (const file of files) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${rel(file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return matches;
}

function assertNoMatches(label, files, pattern) {
  const matches = findMatches(files, pattern);
  if (matches.length) {
    fail(label, matches);
  } else {
    pass(label);
  }
}

function extractServiceMethods(file) {
  const content = read(file);
  const methods = [];
  const methodPattern = /^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/gm;
  let match;

  while ((match = methodPattern.exec(content))) {
    const name = match[1];
    if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(name)) {
      methods.push(name);
    }
  }

  return methods;
}

function assertNoDuplicateMethods(serviceFiles) {
  const duplicates = [];
  for (const file of serviceFiles) {
    const seen = new Set();
    const methods = extractServiceMethods(file);
    for (const method of methods) {
      if (seen.has(method)) {
        duplicates.push(`${rel(file)}: duplicate service method "${method}"`);
      }
      seen.add(method);
    }
  }

  if (duplicates.length) {
    fail('No duplicate method names inside service modules', duplicates);
  } else {
    pass('No duplicate method names inside service modules');
  }
}

function serviceFileFromImport(importPath) {
  if (!importPath.includes('/services/') && !importPath.startsWith('@/services/')) {
    return null;
  }

  const serviceName = importPath.split('/services/').at(-1);
  if (!serviceName) return null;

  const normalizedServiceName = serviceName.replace(/\.js$/, '');
  const file = path.join(root, 'src', 'services', `${normalizedServiceName}.js`);
  return fs.existsSync(file) ? file : null;
}

function assertReferencedServiceMethodsExist() {
  const consumers = [
    ...walk(path.join(root, 'src', 'components'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'contexts'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'hooks'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'lib'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'pages'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'services'), ['.js']),
  ].filter((file) => fs.existsSync(file));

  const serviceMethodCache = new Map();
  const missing = [];
  const importPattern = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

  for (const file of consumers) {
    const content = read(file);
    const imports = new Map();
    let importMatch;

    while ((importMatch = importPattern.exec(content))) {
      const source = importMatch[2];
      const serviceFile = serviceFileFromImport(source);
      if (!serviceFile) continue;

      const names = importMatch[1]
        .split(',')
        .map((name) => name.trim().split(/\s+as\s+/).pop())
        .filter(Boolean);

      for (const name of names) {
        if (name.endsWith('Service')) {
          imports.set(name, serviceFile);
        }
      }
    }

    for (const [serviceName, serviceFile] of imports) {
      if (!serviceMethodCache.has(serviceFile)) {
        serviceMethodCache.set(serviceFile, new Set(extractServiceMethods(serviceFile)));
      }

      const methods = serviceMethodCache.get(serviceFile);
      const callPattern = new RegExp(`\\b${serviceName}\\.([A-Za-z0-9_]+)\\s*\\(`, 'g');
      let callMatch;

      while ((callMatch = callPattern.exec(content))) {
        if (!methods.has(callMatch[1])) {
          missing.push(`${rel(file)} references missing ${serviceName}.${callMatch[1]}() from ${rel(serviceFile)}`);
        }
      }
    }
  }

  if (missing.length) {
    fail('All imported service method calls resolve to declared service contracts', [...new Set(missing)]);
  } else {
    pass('All imported service method calls resolve to declared service contracts');
  }
}

function assertClinicalReferencesExist() {
  const clinicalFile = path.join(root, 'src', 'services', 'clinical.js');
  const methodNames = new Set(extractServiceMethods(clinicalFile));
  const consumers = [
    ...walk(path.join(root, 'src', 'components', 'encounter'), ['.js', '.jsx']),
    ...walk(path.join(root, 'src', 'hooks', 'features'), ['.js', '.jsx']),
    path.join(root, 'src', 'pages', 'DoctorEncounterPage.jsx'),
  ].filter((file) => fs.existsSync(file));

  const missing = [];
  const refPattern = /clinicalService\.([A-Za-z0-9_]+)/g;

  for (const file of consumers) {
    const content = read(file);
    let match;
    while ((match = refPattern.exec(content))) {
      if (!methodNames.has(match[1])) {
        missing.push(`${rel(file)} references missing clinicalService.${match[1]}()`);
      }
    }
  }

  if (missing.length) {
    fail('Encounter layer only calls declared clinical service contracts', [...new Set(missing)]);
  } else {
    pass('Encounter layer only calls declared clinical service contracts');
  }
}

function assertLifecycleRpcsUsed() {
  const clinical = read(path.join(root, 'src', 'services', 'clinical.js'));
  const required = ['start_encounter', 'complete_encounter', 'cancel_encounter', 'finalize_clinical_document', 'void_clinical_document'];
  const missing = required.filter((rpc) => !clinical.includes(`rpc('${rpc}'`) && !clinical.includes(`rpc("${rpc}"`));

  if (missing.length) {
    fail('Clinical lifecycle changes are represented by RPC-backed service methods', missing);
  } else {
    pass('Clinical lifecycle changes are represented by RPC-backed service methods');
  }
}

function assertLegacyCompatibilitySurfacesRemoved() {
  const codeFiles = [
    ...walk(path.join(root, 'src'), ['.js', '.jsx']),
    ...walk(path.join(root, 'supabase', 'functions'), ['.ts', '.js']),
    ...walk(path.join(root, 'scripts'), ['.js', '.mjs']),
  ].filter((file) => rel(file) !== 'scripts/backend-contract-audit.mjs');

  const forbiddenPatterns = [
    /from\s*\(\s*['"]consultations['"]\s*\)/,
    /from\s*\(\s*['"]notifications['"]\s*\)/,
    /from\s*\(\s*['"]doctor_brand['"]\s*\)/,
    /from\s*\(\s*['"]clinic_settings['"]\s*\)/,
    /from\s*\(\s*['"]medical_reports['"]\s*\)/,
    /from\s*\(\s*['"]certificates['"]\s*\)/,
    /from\s*\(\s*['"]referrals['"]\s*\)/,
    /rpc\s*\(\s*['"]get_public_doctor_brand['"]\s*\)/,
    /@\/services\/(?:consultations|notifications|brand|reports|certificates|referrals)\b/,
    /\.\.\/services\/(?:consultations|notifications|brand|reports|certificates|referrals)\b/,
    /\b(?:CONSULTATION|REPORT|CERTIFICATE|REFERRAL|NOTIFICATION|CLINIC_SETTINGS|DOCTOR_BRAND)_SELECT_FIELDS\b/,
    /\bDOCTOR_DASHBOARD_SUMMARY_FIELDS\b/,
    /\b(?:doctor_dashboard_summary|doctor_patients|upcoming_appointments)\b/,
    /rpc\s*\(\s*['"](?:get_user_full_name|get_next_appointment|get_doctor_info)['"]\s*\)/,
    /\bconsultation_id\b/,
    /\bcompleted_consultations\b/,
  ];

  const matches = [];
  for (const pattern of forbiddenPatterns) {
    matches.push(...findMatches(codeFiles, pattern));
  }

  if (matches.length) {
    fail('Legacy compatibility DB/service surfaces are removed from executable code', [...new Set(matches)]);
  } else {
    pass('Legacy compatibility DB/service surfaces are removed from executable code');
  }
}

function assertRetiredEdgeFunctionSourceRemoved() {
  const retiredSlugs = ['auth', 'appointments', 'patients', 'process-payment', 'consultations', 'referrals'];
  const existing = retiredSlugs
    .map((slug) => path.join(root, 'supabase', 'functions', slug))
    .filter((dir) => fs.existsSync(dir))
    .map(rel);

  if (existing.length) {
    fail('Retired V1 Edge Function source directories are removed from the repo', existing);
  } else {
    pass('Retired V1 Edge Function source directories are removed from the repo');
  }
}

function assertDuplicatePublicFunctionNames() {
  const migrationFiles = walk(path.join(root, 'supabase', 'migrations'), ['.sql']);
  const names = new Map();
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;

  for (const file of migrationFiles) {
    const content = read(file);
    let match;
    while ((match = pattern.exec(content))) {
      const name = match[1].toLowerCase();
      const list = names.get(name) || [];
      list.push(rel(file));
      names.set(name, list);
    }
  }

  const duplicates = [...names.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([name, files]) => `${name}: ${[...new Set(files)].join(', ')}`);

  if (duplicates.length) {
    warn('Public function names appear in multiple migrations; verify these are replacements, not overload drift', duplicates);
  } else {
    pass('No repeated public function definitions found in local migrations');
  }
}

function assertKnownLegacyRisksAreTracked() {
  const pageFiles = walk(path.join(root, 'src', 'pages'), ['.js', '.jsx']);
  const directAppointmentCreates = findMatches(pageFiles, /appointmentService\.create\s*\(/);
  if (directAppointmentCreates.length) {
    warn(
      'Legacy appointmentService.create() callers remain; allowed only as compatibility while direct DB inserts stay blocked by service/RLS',
      directAppointmentCreates
    );
  }

  const legacyConsultationRoutes = findMatches(pageFiles, /doctor-consultation/);
  if (legacyConsultationRoutes.length) {
    warn('Legacy doctor-consultation route references remain; migrate consumers to encounter flow before UI release', legacyConsultationRoutes);
  }
}

const srcFiles = walk(path.join(root, 'src'), ['.js', '.jsx']);
const pageFiles = walk(path.join(root, 'src', 'pages'), ['.js', '.jsx']);
const serviceFiles = walk(path.join(root, 'src', 'services'), ['.js']);
const functionFiles = walk(path.join(root, 'supabase', 'functions'), ['.ts', '.js']);

assertNoMatches('Pages must not import or call raw Supabase clients', pageFiles, /\bsupabase\.(from|rpc|auth|storage)\b/);
assertNoMatches('Frontend source must not reference password_hash', srcFiles, /password_hash/);
assertNoMatches('Services and Edge Functions must not use wildcard selects', [...serviceFiles, ...functionFiles], /\.select\s*\(\s*['"`]\*['"`]/);
assertNoMatches('Services must use apiPaged() instead of legacy paginateQuery()', serviceFiles, /\bpaginateQuery\b/);
assertNoMatches('Single-read/write service paths must not return legacy count fields', serviceFiles, /\bcount:\s*null\b|return\s+\{\s*data\s*,\s*count\b/);
assertNoDuplicateMethods(serviceFiles);
assertReferencedServiceMethodsExist();
assertClinicalReferencesExist();
assertLifecycleRpcsUsed();
assertLegacyCompatibilitySurfacesRemoved();
assertRetiredEdgeFunctionSourceRemoved();
assertDuplicatePublicFunctionNames();
assertKnownLegacyRisksAreTracked();

const failed = CHECKS.filter((check) => !check.passed);

console.log('\nBackend Contract Audit');
console.log('======================\n');

for (const check of CHECKS) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
  for (const detail of check.details.slice(0, 25)) {
    console.log(`  - ${detail}`);
  }
  if (check.details.length > 25) {
    console.log(`  - ...${check.details.length - 25} more`);
  }
}

if (WARNINGS.length) {
  console.log('\nTracked warnings');
  console.log('----------------');
  for (const warning of WARNINGS) {
    console.log(`WARN ${warning.message}`);
    for (const detail of warning.details.slice(0, 25)) {
      console.log(`  - ${detail}`);
    }
    if (warning.details.length > 25) {
      console.log(`  - ...${warning.details.length - 25} more`);
    }
  }
}

if (failed.length) {
  console.error(`\n${failed.length} backend contract check(s) failed.`);
  process.exit(1);
}

console.log('\nAll blocking backend contract checks passed.');
