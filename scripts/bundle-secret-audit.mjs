import fs from 'node:fs';
import path from 'node:path';

const GENERAL_SECRET_MARKERS = Object.freeze([
  {
    label: 'Supabase service-role JWT payload marker',
    pattern: /c2VydmljZV9yb2xl/i,
  },
  {
    label: 'service-role key variable name',
    pattern: /service[_-]?role[_-]?key/i,
  },
  {
    label: 'Supabase service-role env name',
    pattern: /SUPABASE_SERVICE_ROLE/i,
  },
  {
    label: 'tenant service-role env name',
    pattern: /TENANT_SERVICE_ROLE/i,
  },
  {
    label: 'control-plane service-role env name',
    pattern: /CONTROL_PLANE_SERVICE_ROLE/i,
  },
  {
    label: 'Supabase secret key prefix',
    pattern: /sb_secret_/i,
  },
  {
    label: 'Vercel token prefix',
    pattern: /vcp_[A-Za-z0-9]/,
  },
  {
    label: 'Stripe secret key prefix',
    pattern: /sk_(live|test)_[A-Za-z0-9]/,
  },
]);

const TENANT_FALLBACK_MARKERS = Object.freeze([
  {
    label: 'tenant Supabase fallback URL/ref',
    pattern: /gezmfmskhmjgnquoyosq/i,
  },
  {
    label: 'tenant anon JWT fallback',
    pattern: /eyJhbGciOiJIUzI1Ni/i,
  },
]);

const DEFAULT_BUNDLE_TARGETS = Object.freeze([
  {
    app: 'unified',
    dir: 'dist',
  },
  {
    app: 'patient-web',
    dir: 'apps/patient-web/dist',
  },
  {
    app: 'clinic-ops',
    dir: 'apps/clinic-ops/dist',
  },
  {
    app: 'control-plane',
    dir: 'apps/control-plane/dist',
  },
  {
    app: process.env.BUNDLE_APP || 'vercel-static',
    dir: '.vercel/output/static',
  },
]);

const APP_DIST_BY_NAME = Object.freeze({
  'patient-web': 'apps/patient-web/dist',
  'clinic-ops': 'apps/clinic-ops/dist',
  'control-plane': 'apps/control-plane/dist',
});

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Bundle directory does not exist: ${dir}`);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath, markers) {
  const source = fs.readFileSync(filePath, 'utf8');
  return markers
    .filter((marker) => marker.pattern.test(source))
    .map((marker) => ({
      filePath,
      label: marker.label,
    }));
}

function markersForApp(app) {
  return app === 'control-plane'
    ? GENERAL_SECRET_MARKERS
    : [...GENERAL_SECRET_MARKERS, ...TENANT_FALLBACK_MARKERS];
}

function resolveBundleTargets(env) {
  if (env.BUNDLE_DIR) {
    return [
      {
        app: env.BUNDLE_APP || 'unknown',
        dir: path.resolve(env.BUNDLE_DIR),
        explicit: true,
      },
    ];
  }

  const candidates = env.BUNDLE_APP && APP_DIST_BY_NAME[env.BUNDLE_APP]
    ? [
        {
          app: env.BUNDLE_APP,
          dir: APP_DIST_BY_NAME[env.BUNDLE_APP],
        },
      ]
    : DEFAULT_BUNDLE_TARGETS;

  return candidates
    .map((target) => ({
      ...target,
      dir: path.resolve(target.dir),
      explicit: false,
    }))
    .filter((target) => fs.existsSync(target.dir));
}

function assertBundleTargets(targets, env) {
  if (targets.length > 0) {
    return;
  }

  if (env.BUNDLE_APP && APP_DIST_BY_NAME[env.BUNDLE_APP]) {
    throw new Error(
      `No local build output exists for ${env.BUNDLE_APP}. Run its build first or set BUNDLE_DIR.`,
    );
  }

  throw new Error(
    'No bundle directories exist. Run a build first or set BUNDLE_DIR to the bundle output you want to scan.',
  );
}

const targets = resolveBundleTargets(process.env);
assertBundleTargets(targets, process.env);

const findings = targets.flatMap((target) =>
  walkFiles(target.dir).flatMap((filePath) =>
    scanFile(filePath, markersForApp(target.app)).map((finding) => ({
      ...finding,
      app: target.app,
    })),
  ),
);

if (findings.length > 0) {
  console.error('FAIL bundle secret audit found forbidden secret/fallback marker(s).');
  for (const finding of findings.slice(0, 20)) {
    console.error(`- ${finding.app}: ${finding.label}: ${path.relative(process.cwd(), finding.filePath)}`);
  }
  if (findings.length > 20) {
    console.error(`- plus ${findings.length - 20} more finding(s)`);
  }
  process.exit(1);
}

console.log(`PASS bundle secret audit scanned ${targets.length} target(s):`);
for (const target of targets) {
  console.log(`- ${target.app}: ${path.relative(process.cwd(), target.dir) || target.dir}`);
}
