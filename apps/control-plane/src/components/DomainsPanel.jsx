import { useEffect, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import {
  buildDomainUpdatePayload,
  canActivateDomainDraft,
  createDomainDrafts,
  DNS_STATUS_OPTIONS,
  DOMAIN_STATUS_OPTIONS,
  hasBlockedDomainActivation,
  SSL_STATUS_OPTIONS,
  updateDomainDraft,
} from '../lib/domainDrafts';
import { buildNoDomainTenantAccess } from '../lib/noDomainAccess';
import { Field, PrimaryButton, SelectInput, StatusPill } from './ui';

export default function DomainsPanel({ tenant, onSaved }) {
  const domains = tenant.tenant_domains || [];
  const noDomainAccess = buildNoDomainTenantAccess(tenant);
  const domainKey = domains
    .map((domain) => `${domain.id}:${domain.hostname}:${domain.status}:${domain.dns_status}:${domain.ssl_status}`)
    .join('|');
  const [drafts, setDrafts] = useState(() => createDomainDrafts(domains));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(createDomainDrafts(domains));
    setMessage('');
  }, [domainKey]);

  function setDomainField(domainId, patch) {
    setDrafts((current) => updateDomainDraft(current, domainId, patch));
  }

  async function saveDomains() {
    const blockedActivation = hasBlockedDomainActivation(drafts);
    setSaving(true);
    const result = await controlPlaneApi.updateTenant({
      tenantId: tenant.id,
      domains: buildDomainUpdatePayload(drafts),
    });
    setSaving(false);
    setMessage(result.error || (
      blockedActivation
        ? 'Domain readiness saved. Domains without verified DNS and issued SSL remain pending.'
        : 'Domain readiness saved.'
    ));
    if (!result.error) onSaved?.();
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Domains</p>
      <h2 className="mt-2 text-2xl font-black">Placeholder-safe routing</h2>
      <p className="mt-2 text-sm text-slate-500">
        DoctoLeb domains stay pending until ownership, DNS, and SSL are verified. Localhost rows can stay active for smoke tests.
      </p>
      {noDomainAccess.available ? (
        <div className="mt-5 rounded-2xl bg-cyan-50 p-4 ring-1 ring-cyan-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-black text-cyan-950">No-domain access</p>
              <p className="mt-1 text-sm text-cyan-800">
                These URLs use path routing for setup, QA, and early access before a real domain is purchased.
              </p>
            </div>
            <StatusPill value="path-ready" />
          </div>
          <div className="mt-4 grid gap-3">
            <a className="break-all rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 ring-1 ring-cyan-100" href={noDomainAccess.patientUrl} target="_blank" rel="noreferrer">
              {noDomainAccess.patientUrl}
            </a>
            <a className="break-all rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 ring-1 ring-cyan-100" href={noDomainAccess.opsUrl} target="_blank" rel="noreferrer">
              {noDomainAccess.opsUrl}
            </a>
          </div>
        </div>
      ) : null}
      <div className="mt-5 grid gap-3">
        {drafts.map((domain) => (
          <div key={domain.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{domain.hostname}</p>
                <p className="text-sm text-slate-500">{domain.surface} surface</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill value={domain.status} />
                {domain.dns_status ? <StatusPill value={`dns:${domain.dns_status}`} /> : null}
                {domain.ssl_status ? <StatusPill value={`ssl:${domain.ssl_status}`} /> : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Domain status">
                <SelectInput
                  value={domain.status}
                  onChange={(event) => setDomainField(domain.id, { status: event.target.value })}
                >
                  {DOMAIN_STATUS_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="DNS status">
                <SelectInput
                  value={domain.dns_status}
                  onChange={(event) => setDomainField(domain.id, { dns_status: event.target.value })}
                >
                  {DNS_STATUS_OPTIONS.map((item) => <option key={item.code || 'empty'} value={item.code}>{item.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="SSL status">
                <SelectInput
                  value={domain.ssl_status}
                  onChange={(event) => setDomainField(domain.id, { ssl_status: event.target.value })}
                >
                  {SSL_STATUS_OPTIONS.map((item) => <option key={item.code || 'empty'} value={item.code}>{item.label}</option>)}
                </SelectInput>
              </Field>
            </div>
            {domain.status === 'active' && !canActivateDomainDraft(domain) ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                This domain will remain pending until DNS is verified and SSL is issued.
              </p>
            ) : null}
          </div>
        ))}
        {drafts.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No domains have been recorded for this tenant yet.</p>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveDomains} disabled={saving || drafts.length === 0}>
          {saving ? 'Saving...' : 'Save domain readiness'}
        </PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500" aria-live="polite">{message}</p> : null}
      </div>
    </section>
  );
}
