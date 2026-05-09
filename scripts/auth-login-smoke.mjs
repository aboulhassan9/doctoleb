process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ||= '1';

const { chromium } = await import('@playwright/test');
const path = await import('node:path');
const {
  assertNoRuntimeIssues,
  collectRuntimeIssues,
  ensurePlaywrightOutputDir,
  getMissingSecretNames,
  playwrightOutputDir,
  readSecret,
  writeJsonReport,
} = await import('./lib/browser-smoke-helpers.mjs');

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

async function verifyPatientBookingEntry(page) {
  const appointmentsUrl = new URL('/patient-appointments', page.url()).toString();
  await page.goto(appointmentsUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading', { name: 'Appointments', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /book new/i }).click({ timeout: 15_000 });

  const doctorSelect = page.getByLabel('Doctor');
  await doctorSelect.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('#patient-booking-doctor');
    return select && Array.from(select.options).some((option) => option.value);
  }, { timeout: 20_000 });

  let doctorState = await doctorSelect.evaluate((select) => ({
    value: select.value,
    options: Array.from(select.options).map((option) => option.textContent?.trim() || ''),
  }));

  if (!doctorState.value) {
    await doctorSelect.selectOption({ index: 1 });
    doctorState = await doctorSelect.evaluate((select) => ({
      value: select.value,
      options: Array.from(select.options).map((option) => option.textContent?.trim() || ''),
    }));
  }

  if (!doctorState.value) {
    throw new Error('patient booking doctor selector did not select a doctor');
  }

  if (doctorState.options.some((option) => {
    const parts = option.split(' - ');
    return parts.some((part, index) => index > 0 && part === parts[index - 1]);
  })) {
    throw new Error('patient booking doctor selector contains duplicated label text');
  }

  const dateDisabled = await page.getByLabel('Appointment Date').evaluate((input) => input.disabled);
  if (dateDisabled) {
    throw new Error('patient booking appointment date stayed disabled after doctor selection');
  }
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
  const runtimeIssues = collectRuntimeIssues(page);

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

    if (scenario.name === 'patient-web-patient') {
      await verifyPatientBookingEntry(page);
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

    assertNoRuntimeIssues(runtimeIssues, scenario.name);

    const screenshotPath = path.join(playwrightOutputDir, `${scenario.name}-auth.png`);
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
  const missingSecretNames = getMissingSecretNames(scenarios);
  if (missingSecretNames.length > 0) {
    const message = `Missing auth smoke environment variables: ${missingSecretNames.join(', ')}`;
    if (required) {
      console.error(message);
      process.exit(1);
    }

    console.log(`${message}. Skipping deployed auth smoke because AUTH_SMOKE_REQUIRED is not true.`);
    return;
  }

  await ensurePlaywrightOutputDir();

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

  const reportPath = await writeJsonReport('deployed-auth-login-qa-report.json', { report, failures });

  if (failures.length > 0) {
    console.error(`Auth smoke failed. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Auth smoke passed. Report: ${reportPath}`);
}

await main();
