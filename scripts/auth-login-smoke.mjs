process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ||= '1';

const { chromium } = await import('@playwright/test');
const fs = await import('node:fs/promises');
const path = await import('node:path');

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'output', 'playwright');
const required = process.env.AUTH_SMOKE_REQUIRED === 'true';

const scenarios = Object.freeze([
  {
    name: 'patient-web-patient',
    url: process.env.PATIENT_WEB_LOGIN_URL || 'https://doctoleb-patient-web.vercel.app/login',
    emailEnv: 'AUTH_SMOKE_PATIENT_EMAIL',
    passwordEnv: 'AUTH_SMOKE_PATIENT_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/patient-dashboard',
  },
  {
    name: 'clinic-ops-doctor',
    url: process.env.CLINIC_OPS_LOGIN_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
    emailEnv: 'AUTH_SMOKE_DOCTOR_EMAIL',
    passwordEnv: 'AUTH_SMOKE_DOCTOR_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/doctor-dashboard',
  },
  {
    name: 'clinic-ops-secretary',
    url: process.env.CLINIC_OPS_LOGIN_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
    emailEnv: 'AUTH_SMOKE_SECRETARY_EMAIL',
    passwordEnv: 'AUTH_SMOKE_SECRETARY_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/dashboard',
  },
  {
    name: 'clinic-ops-predoctor',
    url: process.env.CLINIC_OPS_LOGIN_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
    emailEnv: 'AUTH_SMOKE_PREDOCTOR_EMAIL',
    passwordEnv: 'AUTH_SMOKE_PREDOCTOR_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/predoctor-dashboard',
  },
  {
    name: 'control-plane-owner',
    url: process.env.CONTROL_PLANE_LOGIN_URL || 'https://doctoleb-control-plane.vercel.app/',
    emailEnv: 'AUTH_SMOKE_CONTROL_OWNER_EMAIL',
    passwordEnv: 'AUTH_SMOKE_CONTROL_OWNER_PASSWORD',
    submitName: 'Open console',
    expectedHeading: 'Control plane',
  },
]);

function readSecret(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getMissingSecretNames() {
  return scenarios.flatMap((scenario) => [
    readSecret(scenario.emailEnv) ? null : scenario.emailEnv,
    readSecret(scenario.passwordEnv) ? null : scenario.passwordEnv,
  ]).filter(Boolean);
}

function isCriticalRequest(request) {
  return ['document', 'script', 'xhr', 'fetch'].includes(request.resourceType());
}

function isIgnoredRequestUrl(url) {
  return /\/favicon\.(ico|png|svg)(?:\?|$)/i.test(url);
}

function isExpectedRequestAbort(request) {
  return request.failure()?.errorText === 'net::ERR_ABORTED';
}

function summarizeRuntimeIssues({ consoleErrors, pageErrors, failedRequests, badResponses }) {
  const parts = [];
  if (consoleErrors.length > 0) parts.push(`console=${consoleErrors[0]}`);
  if (pageErrors.length > 0) parts.push(`page=${pageErrors[0]}`);
  if (failedRequests.length > 0) parts.push(`request=${failedRequests[0].method} ${failedRequests[0].url} ${failedRequests[0].failure}`);
  if (badResponses.length > 0) parts.push(`response=${badResponses[0].status} ${badResponses[0].method} ${badResponses[0].url}`);
  return parts.join(' | ');
}

async function verifyScenario(browser, scenario) {
  const email = readSecret(scenario.emailEnv);
  const password = readSecret(scenario.passwordEnv);

  if (!email || !password) {
    throw new Error(`${scenario.name}: missing configured smoke credentials.`);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    if (isCriticalRequest(request) && !isIgnoredRequestUrl(request.url()) && !isExpectedRequestAbort(request)) {
      failedRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()?.errorText || 'unknown',
      });
    }
  });

  page.on('response', (response) => {
    const request = response.request();
    if (response.status() >= 400 && isCriticalRequest(request) && !isIgnoredRequestUrl(response.url())) {
      badResponses.push({
        url: response.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status: response.status(),
      });
    }
  });

  try {
    await page.goto(scenario.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByLabel(/email/i).fill(email, { timeout: 15_000 });
    await page.getByLabel(/^password$/i).fill(password, { timeout: 15_000 });
    await page.getByRole('button', { name: scenario.submitName }).click({ timeout: 15_000 });

    if (scenario.expectedPath) {
      await page.waitForURL((url) => url.pathname === scenario.expectedPath, { timeout: 45_000 });
    }

    if (scenario.expectedHeading) {
      await page.getByRole('heading', { name: scenario.expectedHeading }).waitFor({ state: 'visible', timeout: 45_000 });
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    if (consoleErrors.length > 0 || pageErrors.length > 0 || failedRequests.length > 0 || badResponses.length > 0) {
      throw new Error(`${scenario.name}: browser runtime errors detected. ${summarizeRuntimeIssues({
        consoleErrors,
        pageErrors,
        failedRequests,
        badResponses,
      })}`);
    }

    const screenshotPath = path.join(outputDir, `${scenario.name}-auth.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 20_000 });

    return {
      name: scenario.name,
      url: page.url(),
      screenshotPath,
      passed: true,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const missingSecretNames = getMissingSecretNames();
  if (missingSecretNames.length > 0) {
    const message = `Missing auth smoke environment variables: ${missingSecretNames.join(', ')}`;
    if (required) {
      console.error(message);
      process.exit(1);
    }

    console.log(`${message}. Skipping deployed auth smoke because AUTH_SMOKE_REQUIRED is not true.`);
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = [];
  const failures = [];

  try {
    for (const scenario of scenarios) {
      try {
        const result = await verifyScenario(browser, scenario);
        report.push(result);
        console.log(`PASS ${scenario.name} ${result.url}`);
      } catch (error) {
        failures.push({
          name: scenario.name,
          url: scenario.url,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`FAIL ${scenario.name} ${scenario.url}`);
        console.error(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(outputDir, 'deployed-auth-login-qa-report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      report,
      failures,
    }, null, 2),
  );

  if (failures.length > 0) {
    console.error(`Auth smoke failed. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Auth smoke passed. Report: ${reportPath}`);
}

await main();
