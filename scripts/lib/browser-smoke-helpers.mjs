import fs from 'node:fs/promises';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '..', '..');
export const playwrightOutputDir = path.join(repoRoot, 'output', 'playwright');

export function readSecret(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getMissingSecretNames(scenarios) {
  return scenarios
    .flatMap((scenario) => [
      readSecret(scenario.emailEnv) ? null : scenario.emailEnv,
      readSecret(scenario.passwordEnv) ? null : scenario.passwordEnv,
    ])
    .filter(Boolean);
}

const loginFailurePattern = /invalid (?:login )?(?:credentials|email or password)|unable to sign in|authentication is already in progress|email not confirmed|user not found|missing configured smoke credentials/i;

function describePostLoginExpectation(scenario) {
  if (scenario.expectedPath) return `URL path ${scenario.expectedPath}`;
  if (scenario.expectedHeading) return `heading ${String(scenario.expectedHeading)}`;
  if (scenario.expectedText) return `visible text ${String(scenario.expectedText)}`;
  return 'configured post-login state';
}

function excerpt(value, maxLength = 600) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

async function visibleBodyText(page) {
  return page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
}

async function assertNoVisibleLoginFailure(page, scenario) {
  const bodyText = await visibleBodyText(page);
  const match = bodyText.match(loginFailurePattern);
  if (match) {
    throw new Error(`${scenario.name}: login failed before reaching ${describePostLoginExpectation(scenario)}. Visible error: ${excerpt(match[0], 160)}`);
  }
}

export async function waitForExpectedPostLogin(page, scenario, { timeout = 45_000 } = {}) {
  const startedAt = Date.now();
  const expectation = describePostLoginExpectation(scenario);

  while (Date.now() - startedAt < timeout) {
    if (scenario.expectedPath) {
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === scenario.expectedPath) return;
    }

    if (scenario.expectedHeading) {
      const heading = page.getByRole('heading', { name: scenario.expectedHeading }).first();
      if (await heading.isVisible({ timeout: 500 }).catch(() => false)) return;
    }

    if (scenario.expectedText) {
      const bodyText = await visibleBodyText(page);
      if (bodyText.includes(String(scenario.expectedText))) return;
    }

    await assertNoVisibleLoginFailure(page, scenario);
    await page.waitForTimeout(500);
  }

  const currentUrl = new URL(page.url());
  const bodyText = await visibleBodyText(page);
  throw new Error(`${scenario.name}: expected ${expectation} after login, but current path is ${currentUrl.pathname}. Visible page excerpt: ${excerpt(bodyText)}`);
}

export async function selectPasswordLoginMode(page) {
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15_000 });

  const passwordInput = page.getByLabel(/^password$/i);
  if (await passwordInput.isVisible({ timeout: 500 }).catch(() => false)) {
    return;
  }

  const passwordModeButton = page.getByRole('button', { name: /^Password$/i });
  if (await passwordModeButton.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await passwordModeButton.click({ timeout: 15_000 });
  } else {
    await page.locator('button').filter({ hasText: /^Password$/i }).first().click({ timeout: 15_000 });
  }

  await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
}

export function isCriticalRequest(request) {
  return ['document', 'script', 'xhr', 'fetch'].includes(request.resourceType());
}

export function isIgnoredRequestUrl(url) {
  return /\/favicon\.(ico|png|svg)(?:\?|$)/i.test(url);
}

export function isExpectedRequestAbort(request) {
  return request.failure()?.errorText === 'net::ERR_ABORTED';
}

export function summarizeRuntimeIssues({ consoleErrors, pageErrors, failedRequests, badResponses }) {
  const parts = [];
  if (consoleErrors.length > 0) parts.push(`console=${consoleErrors[0]}`);
  if (pageErrors.length > 0) parts.push(`page=${pageErrors[0]}`);
  if (failedRequests.length > 0) parts.push(`request=${failedRequests[0].method} ${failedRequests[0].url} ${failedRequests[0].failure}`);
  if (badResponses.length > 0) parts.push(`response=${badResponses[0].status} ${badResponses[0].method} ${badResponses[0].url}`);
  return parts.join(' | ');
}

export function collectRuntimeIssues(page) {
  const issues = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on('console', (message) => {
    const text = message.text();
    const isBrowserResourceLoadMirror = /^Failed to load resource: the server responded with a status of \d+ \(\)$/i.test(text);
    if (message.type() === 'error' && !isBrowserResourceLoadMirror) issues.consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    issues.pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    if (isCriticalRequest(request) && !isIgnoredRequestUrl(request.url()) && !isExpectedRequestAbort(request)) {
      issues.failedRequests.push({
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
      issues.badResponses.push({
        url: response.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        status: response.status(),
      });
    }
  });

  return issues;
}

export function assertNoRuntimeIssues(issues, context) {
  if (
    issues.consoleErrors.length > 0
    || issues.pageErrors.length > 0
    || issues.failedRequests.length > 0
    || issues.badResponses.length > 0
  ) {
    throw new Error(`${context}: browser runtime errors detected. ${summarizeRuntimeIssues(issues)}`);
  }
}

export async function ensurePlaywrightOutputDir() {
  await fs.mkdir(playwrightOutputDir, { recursive: true });
}

export async function writeJsonReport(fileName, payload) {
  await ensurePlaywrightOutputDir();
  const reportPath = path.join(playwrightOutputDir, fileName);
  await fs.writeFile(
    reportPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      ...payload,
    }, null, 2),
  );
  return reportPath;
}

export function hasUnsafeControlChars(value) {
  return /[\r\n]|\\[rn]|%0d|%0a/i.test(String(value || ''));
}
