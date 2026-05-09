import { useEffect, useState } from 'react';
import { FEATURE_CATALOG } from '../data/saasCatalog';
import {
  buildManualEntitlementSyncPayload,
  resolveEffectiveEntitlementState,
  resolvePlanEntitlementState,
} from '../lib/entitlementDrafts';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { PrimaryButton } from './ui';

export default function EntitlementsPanel({ tenant, planEntitlements = [], onSaved }) {
  const existing = tenant.tenant_entitlements || [];
  const [enabled, setEnabled] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const hasRuntimeConfig = Boolean(tenant.supabase_project_ref && tenant.supabase_url);
  const planState = resolvePlanEntitlementState({
    planCode: tenant.plan,
    planEntitlements,
    features: FEATURE_CATALOG,
  });

  useEffect(() => {
    setEnabled(resolveEffectiveEntitlementState({
      planCode: tenant.plan,
      planEntitlements,
      tenantEntitlements: existing,
      features: FEATURE_CATALOG,
    }));
    setMessage('');
  }, [tenant.id, tenant.plan, planEntitlements]);

  async function sync() {
    if (!hasRuntimeConfig) {
      setMessage('Save the tenant runtime connection before projecting feature flags.');
      return;
    }

    setSaving(true);
    const payload = buildManualEntitlementSyncPayload({
      desiredState: enabled,
      planState,
      tenantEntitlements: existing,
      features: FEATURE_CATALOG,
    });
    const result = await controlPlaneApi.syncEntitlements({ tenantId: tenant.id, ...payload });
    setSaving(false);
    setMessage(result.error || 'Entitlements saved and projected to tenant feature flags.');
    if (!result.error) onSaved();
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Entitlements</p>
      <h2 className="mt-2 text-2xl font-black">Feature access</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {FEATURE_CATALOG.map((feature) => (
          <label key={feature.code} className="flex cursor-pointer gap-4 rounded-2xl bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={enabled[feature.code] === true}
              onChange={(event) => setEnabled((current) => ({ ...current, [feature.code]: event.target.checked }))}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-700"
            />
            <span>
              <span className="block font-black">{feature.label}</span>
              <span className="block text-sm text-slate-500">{feature.description}</span>
              <span className="mt-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                {enabled[feature.code] === planState[feature.code] ? 'Plan default' : 'Manual override'}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={sync} disabled={saving || !hasRuntimeConfig}>{saving ? 'Syncing...' : 'Sync entitlements'}</PrimaryButton>
        {!hasRuntimeConfig ? <p className="text-sm font-semibold text-slate-500">Runtime connection required first.</p> : null}
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
