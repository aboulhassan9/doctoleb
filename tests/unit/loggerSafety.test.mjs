import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSafeMonitoringContext } from '../../packages/core/lib/logger.js';

describe('logger safety', () => {
  it('keeps only tenant-safe tags and redacts likely PHI/secrets from extra metadata', () => {
    const context = buildSafeMonitoringContext({
      tenantId: 'tenant-1',
      tenantSlug: 'dev',
      surface: 'patient',
      route: '/patient-messages',
      featureCode: 'messaging',
      appVersion: 'test',
      email: 'patient@example.com',
      diagnosisText: 'sensitive',
      serviceKey: 'secret',
      retryCount: 2,
    });

    assert.deepEqual(context.tags, {
      tenantId: 'tenant-1',
      tenantSlug: 'dev',
      surface: 'patient',
      route: '/patient-messages',
      featureCode: 'messaging',
      appVersion: 'test',
    });
    assert.equal(context.extra.email, '[redacted]');
    assert.equal(context.extra.diagnosisText, '[redacted]');
    assert.equal(context.extra.serviceKey, '[redacted]');
    assert.equal(context.extra.retryCount, 2);
  });
});
