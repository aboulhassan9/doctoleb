import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDomainUpdatePayload,
  canActivateDomainDraft,
  createDomainDrafts,
  hasBlockedDomainActivation,
  updateDomainDraft,
} from '../../apps/control-plane/src/lib/domainDrafts.js';

describe('control-plane domain drafts', () => {
  it('normalizes persisted domain rows into editable drafts', () => {
    const drafts = createDomainDrafts([
      {
        id: 'domain-1',
        hostname: ' DEV.DoctoLeb.COM ',
        surface: 'patient',
        status: 'pending',
        dns_status: 'pending',
        ssl_status: 'pending',
        secret: 'must-not-pass',
      },
    ]);

    assert.deepEqual(drafts, [{
      id: 'domain-1',
      hostname: 'dev.doctoleb.com',
      surface: 'patient',
      status: 'pending',
      dns_status: 'pending',
      ssl_status: 'pending',
    }]);
  });

  it('does not activate a non-local domain until DNS and SSL are ready', () => {
    const payload = buildDomainUpdatePayload([
      {
        id: 'domain-1',
        hostname: 'dev.doctoleb.com',
        surface: 'patient',
        status: 'active',
        dns_status: 'pending',
        ssl_status: 'issued',
      },
    ]);

    assert.equal(payload[0].status, 'pending');
  });

  it('allows localhost smoke domains to stay active without DNS and SSL fields', () => {
    const draft = {
      id: 'domain-1',
      hostname: 'localhost:3001',
      surface: 'patient',
      status: 'active',
      dns_status: '',
      ssl_status: '',
    };

    assert.equal(canActivateDomainDraft(draft), true);
    assert.equal(buildDomainUpdatePayload([draft])[0].status, 'active');
  });

  it('allows real domains only after DNS is verified and SSL is issued', () => {
    const draft = {
      id: 'domain-1',
      hostname: 'clinic.example.com',
      surface: 'ops',
      status: 'active',
      dns_status: 'verified',
      ssl_status: 'issued',
    };

    assert.equal(canActivateDomainDraft(draft), true);
    assert.equal(buildDomainUpdatePayload([draft])[0].status, 'active');
  });

  it('updates one draft without mutating the original draft list', () => {
    const drafts = createDomainDrafts([
      {
        id: 'domain-1',
        hostname: 'localhost:3001',
        surface: 'patient',
        status: 'active',
      },
    ]);

    const next = updateDomainDraft(drafts, 'domain-1', { status: 'disabled' });

    assert.equal(drafts[0].status, 'active');
    assert.equal(next[0].status, 'disabled');
  });

  it('reports when an operator requested activation before readiness', () => {
    assert.equal(hasBlockedDomainActivation([{
      id: 'domain-1',
      hostname: 'dev.doctoleb.com',
      surface: 'patient',
      status: 'active',
      dns_status: 'verified',
      ssl_status: 'pending',
    }]), true);
  });
});
