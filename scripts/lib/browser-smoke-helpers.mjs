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
    if (message.type() === 'error') issues.consoleErrors.push(message.text());
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
