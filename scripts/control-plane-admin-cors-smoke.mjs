const baseUrl = process.env.CONTROL_PLANE_FUNCTION_BASE_URL
  || 'https://xouqxgwccewvbtkqming.supabase.co/functions/v1';
const functionName = process.env.CONTROL_PLANE_ADMIN_SMOKE_FUNCTION || 'admin-list-tenants';
const allowedOrigin = process.env.CONTROL_PLANE_CONSOLE_ORIGIN
  || 'https://doctoleb-control-plane.vercel.app';
const forbiddenOrigin = process.env.CONTROL_PLANE_FORBIDDEN_ORIGIN || 'https://evil.example';

function fail(message, details = {}) {
  console.error(`FAIL ${message}`);
  if (Object.keys(details).length) {
    console.error(JSON.stringify(details, null, 2));
  }
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function preflight(origin) {
  const response = await fetch(`${baseUrl}/${functionName}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,apikey,x-client-info',
    },
  });
  const body = await response.text();
  return {
    status: response.status,
    allowOrigin: response.headers.get('access-control-allow-origin'),
    body,
  };
}

const allowed = await preflight(allowedOrigin);
if (allowed.status !== 204 || allowed.allowOrigin !== allowedOrigin) {
  fail('allowed control-plane origin did not receive a strict successful preflight', allowed);
} else {
  pass('allowed control-plane origin receives exact Access-Control-Allow-Origin');
}

const forbidden = await preflight(forbiddenOrigin);
if (
  forbidden.status !== 403
  || forbidden.allowOrigin === forbiddenOrigin
  || !forbidden.body.includes('ORIGIN_NOT_ALLOWED')
) {
  fail('unknown browser origin was not rejected by control-plane admin preflight', forbidden);
} else {
  pass('unknown browser origin is rejected with ORIGIN_NOT_ALLOWED');
}
