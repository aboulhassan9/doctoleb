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
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  Field,
  FormMessage,
  SelectInput,
  SettingsSection,
  StatusPill,
} from './ui';
import { Globe, Server, Link as LinkIcon, ShieldAlert, AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';

function LabeledStatus({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <StatusPill value={value} />
    </span>
  );
}

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
    setMessage('');
    try {
      const result = await controlPlaneApi.updateTenant({
        tenantId: tenant.id,
        domains: buildDomainUpdatePayload(drafts),
      });
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage(
          blockedActivation
            ? 'Domain readiness saved. Some domains remain pending until DNS/SSL verification.'
            : 'Domain readiness saved successfully.',
        );
        onSaved?.();
      }
    } catch (e) {
      setMessage('An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  const isError = message.includes('error') || message.includes('unexpected');

  return (
    <SettingsSection
      title="Routing & Domains"
      description={`Manage custom domains and SSL provisioning for ${tenant.name}`}
      icon={Globe}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          {noDomainAccess.available && (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">Path Routing</span>
                </span>
                <StatusPill value="path-ready" />
              </div>
              <div className="flex flex-col gap-3 p-4">
                <p className="text-sm text-slate-500">
                  These URLs allow immediate access for setup, QA, and early access before a custom domain is verified.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    className="group flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2.5 transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                    href={noDomainAccess.patientUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <LinkIcon className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-teal-600" />
                      <span className="truncate font-mono text-xs text-slate-600 transition-colors group-hover:text-teal-700">
                        {noDomainAccess.patientUrl}
                      </span>
                    </span>
                    <Badge variant="neutral">Patient</Badge>
                  </a>
                  <a
                    className="group flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2.5 transition-colors hover:border-teal-300 hover:bg-teal-50/40"
                    href={noDomainAccess.opsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-teal-600" />
                      <span className="truncate font-mono text-xs text-slate-600 transition-colors group-hover:text-teal-700">
                        {noDomainAccess.opsUrl}
                      </span>
                    </span>
                    <Badge variant="neutral">Clinic Ops</Badge>
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              Custom Domains
              <Badge variant="neutral">{drafts.length}</Badge>
            </h3>

            <div className="flex flex-col gap-3">
              {drafts.map((domain) => (
                <div key={domain.id} className="overflow-hidden rounded-md border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-900">{domain.hostname}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-400">
                        {domain.surface} surface
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusPill value={domain.status} />
                      {domain.dns_status && <LabeledStatus label="DNS" value={domain.dns_status} />}
                      {domain.ssl_status && <LabeledStatus label="SSL" value={domain.ssl_status} />}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 p-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Domain Status">
                        <SelectInput
                          value={domain.status}
                          onChange={(event) => setDomainField(domain.id, { status: event.target.value })}
                        >
                          {DOMAIN_STATUS_OPTIONS.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="DNS Verification">
                        <SelectInput
                          value={domain.dns_status}
                          onChange={(event) => setDomainField(domain.id, { dns_status: event.target.value })}
                        >
                          {DNS_STATUS_OPTIONS.map((item) => (
                            <option key={item.code || 'empty'} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label="SSL Certificate">
                        <SelectInput
                          value={domain.ssl_status}
                          onChange={(event) => setDomainField(domain.id, { ssl_status: event.target.value })}
                        >
                          {SSL_STATUS_OPTIONS.map((item) => (
                            <option key={item.code || 'empty'} value={item.code}>
                              {item.label}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>

                    {domain.status === 'active' && !canActivateDomainDraft(domain) && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        This domain will remain pending until DNS is verified and SSL is issued.
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {drafts.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300">
                    <Globe className="h-5 w-5" />
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900">No custom domains</h4>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    This tenant hasn't mapped any custom domains yet. They can access the platform via path routing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          {message ? (
            <FormMessage tone={isError ? 'error' : 'success'}>{message}</FormMessage>
          ) : (
            <FormMessage tone="info">Domain readiness is synchronized with the Edge routing layer.</FormMessage>
          )}
          <Button onClick={saveDomains} disabled={saving || drafts.length === 0} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Readiness'}
          </Button>
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
