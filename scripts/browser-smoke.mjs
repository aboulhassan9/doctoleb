process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ||= '1';

const { chromium, devices } = await import('@playwright/test');
const fs = await import('node:fs/promises');
const path = await import('node:path');

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'output', 'playwright');

const VIEWPORTS = Object.freeze([
  {
    name: 'desktop',
    use: {
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      isMobile: false,
    },
  },
  {
    name: 'mobile',
    use: devices['Pixel 5'],
  },
]);

const APPS = Object.freeze([
  {
    app: 'patient-web',
    url: process.env.PATIENT_WEB_SMOKE_URL || 'https://doctoleb-patient-web.vercel.app/',
    title: /Patient Portal/i,
    h1: /Patient Portal/i,
    includeText: [
      'What patients can do',
      'Operations portal is separate',
      'Patient Registration',
    ],
    excludeText: [
      'Clinic SaaS for doctors',
      'Run the digital side of your clinic without duct tape.',
      'Wrong portal',
      'SURFACE_MISMATCH',
      'TENANT_NOT_FOUND',
    ],
  },
  {
    app: 'clinic-ops',
    url: process.env.CLINIC_OPS_SMOKE_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
    title: /Clinic Portal/i,
    h1: 'Clinic Operations Portal',
    includeText: [
      'Sign in with your staff credentials',
      'Patient accounts should use the',
    ],
    excludeText: [
      'Wrong portal',
      'SURFACE_MISMATCH',
      'TENANT_NOT_FOUND',
    ],
  },
  {
    app: 'control-plane',
    url: process.env.CONTROL_PLANE_SMOKE_URL || 'https://doctoleb-control-plane.vercel.app/',
    title: /DoctoLeb Console/i,
    h1: 'SaaS control without clinical data.',
    includeText: [
      'Super admin',
      'Uses control-plane Supabase Auth',
    ],
    excludeText: [
      'Missing Control Plane',
      'TENANT_NOT_FOUND',
    ],
  },
]);

function isCriticalRequest(request) {
  return ['document', 'script', 'xhr', 'fetch'].includes(request.resourceType());
}

function isIgnoredRequestUrl(url) {
  return /\/favicon\.(ico|png|svg)(?:\?|$)/i.test(url);
}

function isExpectedRequestAbort(request) {
  return request.failure()?.errorText === 'net::ERR_ABORTED';
}

function assertText(bodyText, expectedText, context) {
  if (!bodyText.toLocaleLowerCase().includes(expectedText.toLocaleLowerCase())) {
    throw new Error(`${context}: expected page text to include "${expectedText}".`);
  }
}

function assertMissingText(bodyText, forbiddenText, context) {
  if (bodyText.toLocaleLowerCase().includes(forbiddenText.toLocaleLowerCase())) {
    throw new Error(`${context}: page unexpectedly contains "${forbiddenText}".`);
  }
}

function summarizeRuntimeIssues({ consoleErrors, pageErrors, failedRequests, badResponses }) {
  const parts = [];
  if (consoleErrors.length > 0) parts.push(`console=${consoleErrors[0]}`);
  if (pageErrors.length > 0) parts.push(`page=${pageErrors[0]}`);
  if (failedRequests.length > 0) parts.push(`request=${failedRequests[0].method} ${failedRequests[0].url} ${failedRequests[0].failure}`);
  if (badResponses.length > 0) parts.push(`response=${badResponses[0].status} ${badResponses[0].method} ${badResponses[0].url}`);
  return parts.join(' | ');
}

async function verifyApp(browser, appConfig, viewportConfig) {
  const context = await browser.newContext({
    ...viewportConfig.use,
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
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

  const contextLabel = `${appConfig.app}/${viewportConfig.name}`;
  try {
    await page.goto(appConfig.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    const title = await page.title();
    if (!appConfig.title.test(title)) {
      throw new Error(`${contextLabel}: expected title ${appConfig.title}, received "${title}".`);
    }

    const heading = page.getByRole('heading', { name: appConfig.h1 }).first();
    await heading.waitFor({ state: 'visible', timeout: 45_000 });

    const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
    for (const expectedText of appConfig.includeText) {
      assertText(bodyText, expectedText, contextLabel);
    }
    for (const forbiddenText of appConfig.excludeText) {
      assertMissingText(bodyText, forbiddenText, contextLabel);
    }

    if (consoleErrors.length > 0 || pageErrors.length > 0 || failedRequests.length > 0 || badResponses.length > 0) {
      throw new Error(`${contextLabel}: browser runtime errors detected. ${summarizeRuntimeIssues({
        consoleErrors,
        pageErrors,
        failedRequests,
        badResponses,
      })}`);
    }

    const screenshotPath = path.join(outputDir, `${appConfig.app}-${viewportConfig.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 20_000 });

    return {
      app: appConfig.app,
      viewport: viewportConfig.name,
      url: appConfig.url,
      title,
      h1: String(appConfig.h1),
      screenshotPath,
      consoleErrors,
      pageErrors,
      failedRequests,
      badResponses,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = [];
  const failures = [];

  try {
    for (const appConfig of APPS) {
      for (const viewportConfig of VIEWPORTS) {
        try {
          const result = await verifyApp(browser, appConfig, viewportConfig);
          report.push(result);
          console.log(`PASS ${result.app}/${result.viewport} ${result.url}`);
        } catch (error) {
          failures.push({
            app: appConfig.app,
            viewport: viewportConfig.name,
            url: appConfig.url,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`FAIL ${appConfig.app}/${viewportConfig.name} ${appConfig.url}`);
          console.error(error instanceof Error ? error.message : String(error));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(outputDir, 'deployed-ui-qa-report.json');
  await fs.writeFile(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      report,
      failures,
    }, null, 2),
  );

  if (failures.length > 0) {
    console.error(`Browser smoke failed. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Browser smoke passed. Report: ${reportPath}`);
}

await main();
