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
  selectPasswordLoginMode,
  waitForExpectedPostLogin,
  writeJsonReport,
} = await import('./lib/browser-smoke-helpers.mjs');

const required = process.env.FLOW_SMOKE_REQUIRED === 'true';
const mutateAppointments = process.env.FLOW_SMOKE_MUTATE_APPOINTMENTS === 'true';
const mutateStaff = process.env.FLOW_SMOKE_MUTATE_STAFF === 'true';
const mutateControlPlane = process.env.FLOW_SMOKE_MUTATE_CONTROL_PLANE === 'true';
const smokeId = (process.env.FLOW_SMOKE_ID || `qa-e2e-${Date.now()}`).toLowerCase();

const URLS = Object.freeze({
  patientLogin: process.env.PATIENT_WEB_LOGIN_URL || 'https://doctoleb-patient-web.vercel.app/t/dev/login',
  clinicOpsLogin: process.env.CLINIC_OPS_LOGIN_URL || 'https://doctoleb-clinic-ops.vercel.app/t/dev/login',
  controlPlaneLogin: process.env.CONTROL_PLANE_LOGIN_URL || 'https://doctoleb-control-plane.vercel.app/',
});

const scenarios = Object.freeze([
  {
    name: 'patient-first-band',
    app: 'patient',
    url: URLS.patientLogin,
    emailEnv: 'AUTH_SMOKE_PATIENT_EMAIL',
    passwordEnv: 'AUTH_SMOKE_PATIENT_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/t/dev/patient-dashboard',
  },
  {
    name: 'doctor-first-band',
    app: 'doctor',
    url: URLS.clinicOpsLogin,
    emailEnv: 'AUTH_SMOKE_DOCTOR_EMAIL',
    passwordEnv: 'AUTH_SMOKE_DOCTOR_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/t/dev/doctor-dashboard',
  },
  {
    name: 'secretary-first-band',
    app: 'secretary',
    url: URLS.clinicOpsLogin,
    emailEnv: 'AUTH_SMOKE_SECRETARY_EMAIL',
    passwordEnv: 'AUTH_SMOKE_SECRETARY_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/t/dev/dashboard',
  },
  {
    name: 'predoctor-first-band',
    app: 'predoctor',
    url: URLS.clinicOpsLogin,
    emailEnv: 'AUTH_SMOKE_PREDOCTOR_EMAIL',
    passwordEnv: 'AUTH_SMOKE_PREDOCTOR_PASSWORD',
    submitName: 'Sign In',
    expectedPath: '/t/dev/predoctor-dashboard',
  },
  {
    name: 'control-plane-first-band',
    app: 'control-plane',
    url: URLS.controlPlaneLogin,
    emailEnv: 'AUTH_SMOKE_CONTROL_OWNER_EMAIL',
    passwordEnv: 'AUTH_SMOKE_CONTROL_OWNER_PASSWORD',
    submitName: /sign in to console/i,
    expectedText: 'Tenants Overview',
  },
]);

function appUrl(loginUrl, routePath) {
  const url = new URL(loginUrl);
  const tenantPrefix = url.pathname.match(/^\/t\/[^/]+/)?.[0] || '';
  url.pathname = `${tenantPrefix}${routePath}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function clickIfVisible(locator) {
  if (await locator.count() === 0) return false;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.click({ timeout: 10_000 });
  return true;
}

async function clearPatientConsentIfPresent(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accepted = await clickIfVisible(page.getByRole('button', { name: /i accept/i }));
    if (!accepted) return;
    await page.waitForTimeout(750);
  }

  throw new Error('patient consent gate stayed open after five acceptance attempts');
}

async function assertNoSensitiveBrowserText(page, context) {
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const forbidden = [
    'service_role',
    'SERVICE_ROLE',
    'supabase_service_role',
    'tenant_service_role',
    'sb_secret_',
    'vcp_',
    'access_token',
    'refresh_token',
  ];
  const found = forbidden.find((token) => bodyText.includes(token));
  if (found) {
    throw new Error(`${context}: browser text exposed forbidden secret marker ${found}.`);
  }
}

async function assertNoClinicalDraftBrowserStorage(page, context) {
  const draftStorageKeys = await page.evaluate(() => {
    const findings = [];
    const stores = [
      ['localStorage', window.localStorage],
      ['sessionStorage', window.sessionStorage],
    ];

    for (const [storageName, storage] of stores) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || '';
        const value = storage.getItem(key) || '';
        if (/clinical.*draft|encounter.*draft|note.*draft/i.test(`${key} ${value}`)) {
          findings.push(`${storageName}:${key}`);
        }
      }
    }

    return findings;
  });

  if (draftStorageKeys.length > 0) {
    throw new Error(`${context}: clinical draft markers found in browser storage keys: ${draftStorageKeys.join(', ')}`);
  }
}

async function signIn(page, scenario) {
  const email = readSecret(scenario.emailEnv);
  const password = readSecret(scenario.passwordEnv);
  if (!email || !password) {
    throw new Error(`${scenario.name}: missing configured flow credentials.`);
  }

  await page.goto(scenario.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await selectPasswordLoginMode(page);
  await page.getByLabel(/email/i).fill(email, { timeout: 15_000 });
  await page.getByLabel(/^password$/i).fill(password, { timeout: 15_000 });
  await page.getByRole('button', { name: scenario.submitName }).click({ timeout: 15_000 });

  await waitForExpectedPostLogin(page, scenario);

  if (scenario.app === 'patient') {
    await clearPatientConsentIfPresent(page);
  }
}

async function logoutIfVisible(page) {
  const logoutButton = page.getByRole('button', { name: /logout|sign out|secure sign out/i }).first();
  if (await logoutButton.count() === 0) return false;
  if (!(await logoutButton.isVisible().catch(() => false))) return false;
  await logoutButton.click({ timeout: 10_000 });
  return true;
}

async function assertLogoutAndStorageCleanup(page, context) {
  const loggedOut = await logoutIfVisible(page);
  if (!loggedOut) {
    throw new Error(`${context}: logout control was not visible.`);
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => {
    const findings = [];
    const stores = [
      ['localStorage', window.localStorage],
      ['sessionStorage', window.sessionStorage],
    ];

    for (const [storageName, storage] of stores) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || '';
        const value = storage.getItem(key) || '';
        if (/^sb-|supabase|auth|token/i.test(key) || /access_token|refresh_token|eyJhbGciOi/i.test(value)) {
          findings.push(`${storageName}:${key}`);
        }
      }
    }

    return findings.length === 0;
  }, null, { timeout: 10_000 }).catch(() => undefined);

  const authStorageKeys = await page.evaluate(() => {
    const findings = [];
    const stores = [
      ['localStorage', window.localStorage],
      ['sessionStorage', window.sessionStorage],
    ];

    for (const [storageName, storage] of stores) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || '';
        const value = storage.getItem(key) || '';
        if (/^sb-|supabase|auth|token/i.test(key) || /access_token|refresh_token|eyJhbGciOi/i.test(value)) {
          findings.push(`${storageName}:${key}`);
        }
      }
    }

    return findings;
  });

  if (authStorageKeys.length > 0) {
    throw new Error(`${context}: logout left auth storage keys: ${authStorageKeys.join(', ')}`);
  }
}

async function verifyPatientFlow(page) {
  await page.goto(appUrl(URLS.patientLogin, '/patient-profile'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await clearPatientConsentIfPresent(page);
  await page.getByRole('heading', { name: /My Profile/i }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: /Edit Profile/i }).click({ timeout: 15_000 });
  await page.getByRole('button', { name: /Save Changes/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByText(/^First Name$/i).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /^Cancel$/i }).click({ timeout: 15_000 });

  await page.goto(appUrl(URLS.patientLogin, '/patient-appointments'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await clearPatientConsentIfPresent(page);
  await page.getByRole('heading', { name: 'Appointments', exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: /Book New/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /Book an Appointment/i }).waitFor({ state: 'visible', timeout: 15_000 });

  const doctorSelect = page.getByLabel('Doctor');
  await doctorSelect.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('#patient-booking-doctor');
    return select && Array.from(select.options).some((option) => option.value);
  }, { timeout: 20_000 });

  let selectedDoctorId = await doctorSelect.inputValue();
  if (!selectedDoctorId) {
    await doctorSelect.selectOption({ index: 1 });
    selectedDoctorId = await doctorSelect.inputValue();
  }

  if (!selectedDoctorId) {
    throw new Error('patient flow: doctor selector did not resolve a selectable doctor');
  }

  const dateDisabled = await page.getByLabel('Appointment Date').evaluate((input) => input.disabled);
  if (dateDisabled) {
    throw new Error('patient flow: appointment date stayed disabled after doctor selection');
  }

  if (mutateAppointments) {
    await page.getByLabel('Appointment Date').fill(tomorrowIsoDate());
    await page.waitForTimeout(1500);
    const firstSlot = page.getByRole('button').filter({ hasText: /^\d{1,2}:\d{2}/ }).first();
    if (await firstSlot.count() === 0) {
      throw new Error('patient flow: mutation mode requested but no available slot button was rendered');
    }
    await firstSlot.click({ timeout: 10_000 });
    await page.getByLabel(/Reason for Visit/i).fill(`QA appointment smoke ${smokeId}`);
    await page.getByRole('button', { name: /Book Appointment/i }).click({ timeout: 15_000 });
    await page.getByRole('button', { name: /Cancel/i }).first().waitFor({ state: 'visible', timeout: 45_000 });
  }

  await assertNoSensitiveBrowserText(page, 'patient flow');
  await assertNoClinicalDraftBrowserStorage(page, 'patient flow');
  await assertLogoutAndStorageCleanup(page, 'patient flow');
}

async function verifyDoctorFlow(page) {
  await page.goto(appUrl(URLS.clinicOpsLogin, '/doctor-staff'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading', { name: /Staff Roster/i }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: /Add Staff Member/i }).first().click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /^Add Staff Member$/i }).waitFor({ state: 'visible', timeout: 15_000 });

  const staffEmail = `${smokeId}+staff@example.invalid`;
  await page.getByPlaceholder(/Sarah Johnson/i).fill(`QA Staff ${smokeId}`);
  await page.getByPlaceholder(/user@example\.com/i).fill(staffEmail);
  await page.getByPlaceholder(/\+961 70 123 456/i).fill('+96170000000');

  if (mutateStaff) {
    await page.getByRole('button', { name: /Send Invite/i }).click({ timeout: 15_000 });
    await page.getByText(staffEmail).waitFor({ state: 'visible', timeout: 45_000 });
    const activeStaffCard = page.locator('div', { hasText: staffEmail }).filter({ has: page.getByRole('button', { name: /Resend invite/i }) }).first();
    await activeStaffCard.getByRole('button', { name: /Resend invite/i }).click({ timeout: 15_000 });
    await page.getByText(/Staff invite resent|Invite resent/i).waitFor({ state: 'visible', timeout: 45_000 });
    await activeStaffCard.getByRole('button', { name: /Cancel staff invite/i }).click({ timeout: 15_000 });
    await page.getByRole('button', { name: /Cancel invite/i }).click({ timeout: 15_000 });
    await page.getByLabel(/Show inactive/i).check({ timeout: 15_000 });
    await page.getByText(staffEmail).waitFor({ state: 'visible', timeout: 45_000 });
    const inactiveStaffCard = page.locator('div', { hasText: staffEmail }).filter({ has: page.getByRole('button', { name: /Reissue cancelled invite/i }) }).first();
    await inactiveStaffCard.getByRole('button', { name: /Reissue cancelled invite/i }).click({ timeout: 15_000 });
    await page.getByText(/Staff invite reissued/i).waitFor({ state: 'visible', timeout: 45_000 });
  } else {
    await page.getByRole('button', { name: /^Cancel$/i }).click({ timeout: 15_000 });
  }

  await assertNoSensitiveBrowserText(page, 'doctor staff flow');
  await assertNoClinicalDraftBrowserStorage(page, 'doctor staff flow');
  await assertLogoutAndStorageCleanup(page, 'doctor staff flow');
}

async function verifySecretaryFlow(page) {
  await page.goto(appUrl(URLS.clinicOpsLogin, '/patients'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading', { name: /Patient Directory/i }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByPlaceholder(/Search by name/i).fill(smokeId);
  await page.getByRole('button', { name: /Register New Patient/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /Register New Patient/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByPlaceholder(/Johnathan Doe/i).fill(`QA Patient ${smokeId}`);
  await page.getByPlaceholder(/\+1 \(555\) 000-0000/i).first().fill('+96171000000');
  await page.getByRole('button', { name: /^Cancel$/i }).click({ timeout: 15_000 });

  await page.goto(appUrl(URLS.clinicOpsLogin, '/secretary-booking'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading', { name: /Book Appointment/i }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: /Create New Patient Profile/i }).click({ timeout: 15_000 });
  await page.locator('input').nth(1).waitFor({ state: 'visible', timeout: 15_000 });
  await assertNoSensitiveBrowserText(page, 'secretary flow');
  await assertNoClinicalDraftBrowserStorage(page, 'secretary flow');
  await assertLogoutAndStorageCleanup(page, 'secretary flow');
}

async function verifyPredoctorFlow(page) {
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 45_000 });
  await page.goto(appUrl(URLS.clinicOpsLogin, '/predoctor-patients'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.getByRole('heading').first().waitFor({ state: 'visible', timeout: 45_000 });
  await assertNoSensitiveBrowserText(page, 'predoctor flow');
  await assertNoClinicalDraftBrowserStorage(page, 'predoctor flow');
  await assertLogoutAndStorageCleanup(page, 'predoctor flow');
}

async function verifyControlPlaneFlow(page) {
  await page.getByText(/Tenants Overview/i).waitFor({ state: 'visible', timeout: 45_000 });
  if (await page.getByRole('tab', { name: /Setup/i }).count() > 0) {
    throw new Error('control-plane flow: deprecated Setup tab is still visible.');
  }

  await page.getByRole('button', { name: /Add New Tenant/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /New tenant setup/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('heading', { name: /Guided tenant launch/i }).waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByText(/does not edit/i).waitFor({ state: 'visible', timeout: 15_000 });

  const slug = smokeId.replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  await page.getByLabel(/Clinic name/i).fill(`QA Clinic ${slug}`);
  await page.getByRole('textbox', { name: /Slug/i }).fill(slug);
  await page.getByRole('button', { name: /Next step/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /First doctor setup/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByLabel(/First doctor admin/i).fill(`QA Doctor ${slug}`);
  await page.getByLabel(/First doctor email/i).fill(`${slug}+doctor@example.invalid`);
  await page.getByLabel(/First doctor phone/i).fill('+96172000000');
  await page.getByRole('button', { name: /Next step/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /No-domain hosting path/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: /Next step/i }).click({ timeout: 15_000 });
  await page.getByRole('heading', { name: /Create tenant draft/i }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByText(`${slug}.doctoleb.com`).waitFor({ state: 'visible', timeout: 15_000 });

  if (mutateControlPlane) {
    await page.getByRole('button', { name: /Create tenant draft/i }).click({ timeout: 15_000 });
    await page.getByText(/Tenant draft, pending domains, plan, and checklist created/i).waitFor({ state: 'visible', timeout: 45_000 });
    await clickIfVisible(page.getByRole('button', { name: /Cancel provisioning job/i }));
  }

  await assertNoSensitiveBrowserText(page, 'control-plane flow');
  await assertNoClinicalDraftBrowserStorage(page, 'control-plane flow');
  await assertLogoutAndStorageCleanup(page, 'control-plane flow');
}

async function verifyScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const runtimeIssues = collectRuntimeIssues(page);

  try {
    await signIn(page, scenario);

    if (scenario.app === 'patient') await verifyPatientFlow(page);
    if (scenario.app === 'doctor') await verifyDoctorFlow(page);
    if (scenario.app === 'secretary') await verifySecretaryFlow(page);
    if (scenario.app === 'predoctor') await verifyPredoctorFlow(page);
    if (scenario.app === 'control-plane') await verifyControlPlaneFlow(page);

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    assertNoRuntimeIssues(runtimeIssues, scenario.name);

    const screenshotPath = path.join(playwrightOutputDir, `${scenario.name}-flow.png`);
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
    const message = `Missing deployed flow smoke environment variables: ${missingSecretNames.join(', ')}`;
    if (required) {
      console.error(message);
      process.exit(1);
    }

    console.log(`${message}. Skipping deployed flow smoke because FLOW_SMOKE_REQUIRED is not true.`);
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

  const reportPath = await writeJsonReport('deployed-flow-qa-report.json', {
    smokeId,
    mutationFlags: {
      appointments: mutateAppointments,
      staff: mutateStaff,
      controlPlane: mutateControlPlane,
    },
    report,
    failures,
  });

  if (failures.length > 0) {
    console.error(`Deployed flow smoke failed. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Deployed flow smoke passed. Report: ${reportPath}`);
}

await main();
