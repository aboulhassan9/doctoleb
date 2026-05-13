const APPS = Object.freeze([
  {
    app: 'patient-web',
    url: process.env.PATIENT_WEB_SMOKE_URL || 'https://doctoleb-patient-web.vercel.app/',
  },
  {
    app: 'clinic-ops',
    url: process.env.CLINIC_OPS_SMOKE_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
  },
  {
    app: 'control-plane',
    url: process.env.CONTROL_PLANE_SMOKE_URL || 'https://doctoleb-control-plane.vercel.app/',
  },
]);

function selectedSmokeApps() {
  return new Set(String(process.env.SMOKE_APPS || '')
    .split(',')
    .map((app) => app.trim())
    .filter(Boolean));
}

const REQUIRED_HEADERS = Object.freeze([
  ['x-content-type-options', /nosniff/i],
  ['x-frame-options', /deny/i],
  ['referrer-policy', /strict-origin-when-cross-origin/i],
  ['permissions-policy', /camera=\(\)/i],
]);

const REQUIRED_CSP_DIRECTIVES = Object.freeze([
  /default-src 'self'/,
  /base-uri 'self'/,
  /object-src 'none'/,
  /frame-ancestors 'none'/,
  /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/,
]);

function assertHeader(headers, name, pattern, context) {
  const value = headers.get(name);
  if (!value || !pattern.test(value)) {
    throw new Error(`${context}: expected ${name} to match ${pattern}, received ${value || 'missing'}.`);
  }
}

async function verifyApp({ app, url }) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'user-agent': 'DoctoLeb-CSP-Smoke/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`${app}: expected 2xx response from ${url}, received ${response.status}.`);
  }

  for (const [name, pattern] of REQUIRED_HEADERS) {
    assertHeader(response.headers, name, pattern, app);
  }

  const enforced = response.headers.get('content-security-policy');
  const reportOnly = response.headers.get('content-security-policy-report-only');
  if (enforced) {
    throw new Error(`${app}: CSP is enforced before the report-only browser suite is clean.`);
  }
  if (!reportOnly) {
    throw new Error(`${app}: missing Content-Security-Policy-Report-Only header.`);
  }

  for (const directive of REQUIRED_CSP_DIRECTIVES) {
    if (!directive.test(reportOnly)) {
      throw new Error(`${app}: CSP report-only header is missing directive ${directive}.`);
    }
  }
  if (/upgrade-insecure-requests/i.test(reportOnly)) {
    throw new Error(`${app}: report-only CSP must not include upgrade-insecure-requests because Chromium reports it as a console error.`);
  }

  return {
    app,
    url,
    status: response.status,
    cspMode: 'report-only',
  };
}

const failures = [];
const report = [];

const selectedApps = selectedSmokeApps();
const appsToVerify = selectedApps.size === 0
  ? APPS
  : APPS.filter((app) => selectedApps.has(app.app));

if (appsToVerify.length === 0) {
  console.error(`SMOKE_APPS did not match any CSP smoke app: ${[...selectedApps].join(', ')}`);
  process.exit(1);
}

for (const app of appsToVerify) {
  try {
    const result = await verifyApp(app);
    report.push(result);
    console.log(`PASS ${result.app} ${result.url}`);
  } catch (error) {
    failures.push({
      app: app.app,
      url: app.url,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`FAIL ${app.app} ${app.url}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ report }, null, 2));
