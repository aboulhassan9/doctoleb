const resolverUrl = process.env.TENANT_RESOLVER_SMOKE_URL
  || 'https://xouqxgwccewvbtkqming.supabase.co/functions/v1/tenant-resolve';

const patientHost = process.env.TENANT_RESOLVER_PATIENT_HOST || 'doctoleb-patient-web.vercel.app';
const opsHost = process.env.TENANT_RESOLVER_OPS_HOST || 'doctoleb-clinic-ops.vercel.app';
const unknownHost = process.env.TENANT_RESOLVER_UNKNOWN_HOST || 'unknown-doctoleb-smoke.invalid';
const pendingPatientHost = process.env.TENANT_RESOLVER_PENDING_PATIENT_HOST || 'dev.doctoleb.com';
const pendingOpsHost = process.env.TENANT_RESOLVER_PENDING_OPS_HOST || 'dev.ops.doctoleb.com';

const SECRET_MARKERS = Object.freeze([
  /service[_-]?role/i,
  /SUPABASE_SERVICE_ROLE/i,
  /TENANT_SERVICE_ROLE/i,
  /CONTROL_PLANE_SERVICE_ROLE/i,
  /sb_secret_/i,
  /vcp_[A-Za-z0-9]/,
  /sk_(live|test)_[A-Za-z0-9]/,
]);

const SUCCESS_CASES = Object.freeze([
  {
    name: 'patient Vercel host resolves',
    host: patientHost,
    surface: 'patient',
    expectedSurface: 'patient',
  },
  {
    name: 'ops Vercel host resolves',
    host: opsHost,
    surface: 'ops',
    expectedSurface: 'ops',
  },
  {
    name: 'uppercase patient host resolves case-insensitively',
    host: patientHost.toUpperCase(),
    surface: 'patient',
    expectedSurface: 'patient',
  },
]);

const ERROR_CASES = Object.freeze([
  {
    name: 'unknown host returns tenant not found',
    host: unknownHost,
    surface: 'patient',
    expectedStatus: 404,
    expectedError: 'TENANT_NOT_FOUND',
  },
  {
    name: 'wrong surface returns surface mismatch',
    host: opsHost,
    surface: 'patient',
    expectedStatus: 403,
    expectedError: 'SURFACE_MISMATCH',
  },
  {
    name: 'pending patient domain remains inactive before domain purchase',
    host: pendingPatientHost,
    surface: 'patient',
    expectedStatus: 423,
    expectedError: 'TENANT_INACTIVE',
  },
  {
    name: 'pending ops domain remains inactive before domain purchase',
    host: pendingOpsHost,
    surface: 'ops',
    expectedStatus: 423,
    expectedError: 'TENANT_INACTIVE',
  },
]);

function buildUrl(host, surface) {
  const url = new URL(resolverUrl);
  url.searchParams.set('host', host);
  url.searchParams.set('surface', surface);
  return url;
}

function assertNoSecretMarkers(caseName, rawBody) {
  for (const marker of SECRET_MARKERS) {
    if (marker.test(rawBody)) {
      throw new Error(`${caseName}: resolver response contains forbidden secret marker ${marker}.`);
    }
  }
}

async function requestCase(testCase) {
  const url = buildUrl(testCase.host, testCase.surface);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const rawBody = await response.text();
  assertNoSecretMarkers(testCase.name, rawBody);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (error) {
    throw new Error(`${testCase.name}: resolver returned non-JSON response: ${rawBody.slice(0, 200)}`);
  }

  return {
    response,
    body,
  };
}

function assertSuccessEnvelope(testCase, status, body) {
  if (status !== 200) {
    throw new Error(`${testCase.name}: expected HTTP 200, received ${status} ${JSON.stringify(body)}`);
  }

  if (body.error !== null || !body.data) {
    throw new Error(`${testCase.name}: expected { data, error: null }, received ${JSON.stringify(body)}`);
  }

  if (body.data.slug !== 'dev') {
    throw new Error(`${testCase.name}: expected dev tenant slug, received ${body.data.slug}`);
  }

  if (body.data.surface !== testCase.expectedSurface) {
    throw new Error(`${testCase.name}: expected surface ${testCase.expectedSurface}, received ${body.data.surface}`);
  }

  if (body.data.supabaseUrl !== 'https://gezmfmskhmjgnquoyosq.supabase.co') {
    throw new Error(`${testCase.name}: expected gezmfmskhmjgnquoyosq tenant URL, received ${body.data.supabaseUrl}`);
  }

  if (typeof body.data.supabaseAnonKey !== 'string' || body.data.supabaseAnonKey.length < 20) {
    throw new Error(`${testCase.name}: expected public tenant anon key string.`);
  }

  if (!body.data.canonicalHost) {
    throw new Error(`${testCase.name}: expected canonicalHost in resolver data.`);
  }
}

function assertErrorEnvelope(testCase, status, body) {
  if (status !== testCase.expectedStatus) {
    throw new Error(`${testCase.name}: expected HTTP ${testCase.expectedStatus}, received ${status} ${JSON.stringify(body)}`);
  }

  if (body.data !== null || body.error !== testCase.expectedError) {
    throw new Error(`${testCase.name}: expected error ${testCase.expectedError}, received ${JSON.stringify(body)}`);
  }
}

const failures = [];

for (const testCase of SUCCESS_CASES) {
  try {
    const { response, body } = await requestCase(testCase);
    assertSuccessEnvelope(testCase, response.status, body);
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    console.error(`FAIL ${testCase.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

for (const testCase of ERROR_CASES) {
  try {
    const { response, body } = await requestCase(testCase);
    assertErrorEnvelope(testCase, response.status, body);
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    console.error(`FAIL ${testCase.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error(`Tenant resolver smoke failed with ${failures.length} failure(s).`);
  process.exit(1);
}

console.log('Tenant resolver smoke passed.');
