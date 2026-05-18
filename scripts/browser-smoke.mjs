process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ||= '1';

const { chromium, devices } = await import('@playwright/test');
const path = await import('node:path');
const {
  assertNoRuntimeIssues,
  collectRuntimeIssues,
  ensurePlaywrightOutputDir,
  hasUnsafeControlChars,
  playwrightOutputDir,
  writeJsonReport,
} = await import('./lib/browser-smoke-helpers.mjs');

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
    app: 'patient-web-root',
    url: process.env.PATIENT_WEB_SMOKE_URL || 'https://doctoleb-patient-web.vercel.app/',
    title: /Patient Portal/i,
    h1: 'Clinic not found',
    includeText: [
      'This address is not connected to any DoctoLeb clinic',
      'TENANT_NOT_FOUND',
    ],
    expectedBadResponses: [
      {
        status: 404,
        urlIncludes: 'functions/v1/tenant-resolve',
      },
    ],
    excludeText: [
      'Patient care starts here',
      'Clinic SaaS for doctors',
      'Run the digital side of your clinic without duct tape.',
      'Wrong portal',
      'SURFACE_MISMATCH',
    ],
  },
  {
    app: 'patient-web',
    url: process.env.PATIENT_WEB_PATH_SMOKE_URL || 'https://doctoleb-patient-web.vercel.app/t/dev',
    title: /Patient Portal/i,
    h1: 'Patient care starts here.',
    includeText: [
      'Doctor-led clinic access',
      'Available patient services',
      'Private patient access',
      'Patient Registration',
    ],
    excludeText: [
      'Clinic SaaS for doctors',
      'Run the digital side of your clinic without duct tape.',
      'Wrong portal',
      'SURFACE_MISMATCH',
      'TENANT_NOT_FOUND',
    ],
    links: [
      {
        text: /Patient Registration/i,
        expectedPath: '/t/dev/signup',
      },
      {
        text: /Patient Login/i,
        expectedPath: '/t/dev/login',
      },
    ],
  },
  {
    app: 'clinic-ops-root',
    url: process.env.CLINIC_OPS_SMOKE_URL || 'https://doctoleb-clinic-ops.vercel.app/login',
    title: /Clinic Operations|Clinic Portal|DoctoLeb/i,
    h1: 'Clinic not found',
    includeText: [
      'This address is not connected to any DoctoLeb clinic',
      'TENANT_NOT_FOUND',
    ],
    expectedBadResponses: [
      {
        status: 404,
        urlIncludes: 'functions/v1/tenant-resolve',
      },
    ],
    excludeText: [
      'Clinic Operations Portal',
      'Wrong portal',
      'SURFACE_MISMATCH',
    ],
  },
  {
    app: 'clinic-ops',
    url: process.env.CLINIC_OPS_PATH_SMOKE_URL || 'https://doctoleb-clinic-ops.vercel.app/t/dev/login',
    title: /Clinic Operations|Clinic Portal/i,
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
    links: [
      {
        text: /Patient Portal/i,
        expectedUrl: process.env.PATIENT_WEB_PATH_LOGIN_URL || 'https://doctoleb-patient-web.vercel.app/t/dev/login',
      },
    ],
  },
  {
    app: 'control-plane',
    url: process.env.CONTROL_PLANE_SMOKE_URL || 'https://doctoleb-control-plane.vercel.app/',
    title: /DoctoLeb Console/i,
    h1: 'Welcome back',
    includeText: [
      'Welcome back',
      'Sign in with your control-plane credentials',
      'Only authorized staff',
    ],
    excludeText: [
      'Missing Control Plane',
      'TENANT_NOT_FOUND',
    ],
  },
]);

function selectedSmokeApps() {
  return new Set(String(process.env.SMOKE_APPS || '')
    .split(',')
    .map((app) => app.trim())
    .filter(Boolean));
}

function appMatchesSelection(appName, selectedApps) {
  if (selectedApps.size === 0) return true;
  if (selectedApps.has(appName)) return true;
  if (selectedApps.has('patient-web') && appName.startsWith('patient-web')) return true;
  if (selectedApps.has('clinic-ops') && appName.startsWith('clinic-ops')) return true;
  if (selectedApps.has('control-plane') && appName === 'control-plane') return true;
  return false;
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

function assertSameUrl(actualUrl, expectedUrl, context) {
  const actual = new URL(actualUrl);
  const expected = new URL(expectedUrl);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
    throw new Error(`${context}: expected link to resolve to ${expected.origin}${expected.pathname}, received ${actual.origin}${actual.pathname}.`);
  }
}

async function assertLinks(page, rules, context) {
  if (!rules?.length) return;

  const links = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => ({
    text: node.textContent || '',
    href: node.getAttribute('href') || '',
    resolvedHref: node.href || '',
  })));

  for (const rule of rules) {
    const matchingLinks = links.filter((link) => rule.text.test(link.text));
    if (matchingLinks.length === 0) {
      throw new Error(`${context}: expected at least one link matching ${rule.text}.`);
    }

    for (const link of matchingLinks) {
      if (hasUnsafeControlChars(link.href) || hasUnsafeControlChars(link.resolvedHref)) {
        throw new Error(`${context}: link "${link.text.trim()}" contains unsafe control characters in href.`);
      }

      if (rule.expectedPath) {
        const resolved = new URL(link.resolvedHref);
        if (resolved.pathname !== rule.expectedPath) {
          throw new Error(`${context}: expected link "${link.text.trim()}" to resolve to ${rule.expectedPath}, received ${resolved.pathname}.`);
        }
      }

      if (rule.expectedUrl) {
        assertSameUrl(link.resolvedHref, rule.expectedUrl, `${context}: link "${link.text.trim()}"`);
      }
    }
  }
}

function isExpectedBadResponse(response, expectedBadResponses = []) {
  return expectedBadResponses.some((expected) => (
    response.status === expected.status
      && String(response.url || '').includes(expected.urlIncludes)
  ));
}

function filterExpectedRuntimeIssues(runtimeIssues, appConfig) {
  return {
    ...runtimeIssues,
    badResponses: runtimeIssues.badResponses.filter((response) => !isExpectedBadResponse(
      response,
      appConfig.expectedBadResponses,
    )),
  };
}

async function verifyApp(browser, appConfig, viewportConfig) {
  const context = await browser.newContext({
    ...viewportConfig.use,
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const runtimeIssues = collectRuntimeIssues(page);

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
    await assertLinks(page, appConfig.links, contextLabel);

    const filteredRuntimeIssues = filterExpectedRuntimeIssues(runtimeIssues, appConfig);
    assertNoRuntimeIssues(filteredRuntimeIssues, contextLabel);

    const screenshotPath = path.join(playwrightOutputDir, `${appConfig.app}-${viewportConfig.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 20_000 });

    return {
      app: appConfig.app,
      viewport: viewportConfig.name,
      url: appConfig.url,
      title,
      h1: String(appConfig.h1),
      screenshotPath,
      consoleErrors: filteredRuntimeIssues.consoleErrors,
      pageErrors: filteredRuntimeIssues.pageErrors,
      failedRequests: filteredRuntimeIssues.failedRequests,
      badResponses: filteredRuntimeIssues.badResponses,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await ensurePlaywrightOutputDir();

  const browser = await chromium.launch({ headless: true });
  const report = [];
  const failures = [];

  try {
    const selectedApps = selectedSmokeApps();
    const appsToVerify = APPS.filter((appConfig) => appMatchesSelection(appConfig.app, selectedApps));
    if (appsToVerify.length === 0) {
      throw new Error(`SMOKE_APPS did not match any browser smoke app: ${[...selectedApps].join(', ')}`);
    }

    for (const appConfig of appsToVerify) {
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

  const reportPath = await writeJsonReport('deployed-ui-qa-report.json', { report, failures });

  if (failures.length > 0) {
    console.error(`Browser smoke failed. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Browser smoke passed. Report: ${reportPath}`);
}

await main();
