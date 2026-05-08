import { useEffect, useState } from 'react';
import { FEATURE_CATALOG } from '../data/saasCatalog';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { PrimaryButton } from './ui';

export default function EntitlementsPanel({ tenant, onSaved }) {
  const existing = tenant.tenant_entitlements || [];
  const [enabled, setEnabled] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const state = {};
    for (const feature of FEATURE_CATALOG) {
      const row = existing.find((item) => item.feature_code === feature.code && item.source === 'manual_override');
      state[feature.code] = row ? row.is_enabled === true : false;
    }
    setEnabled(state);
    setMessage('');
  }, [tenant.id]);

  async function sync() {
    setSaving(true);
    const entitlements = FEATURE_CATALOG.map((feature) => ({
      feature_code: feature.code,
      source: 'manual_override',
      is_enabled: enabled[feature.code] === true,
      limits: {},
      reason: 'Console toggle',
    }));
    const result = await controlPlaneApi.syncEntitlements({ tenantId: tenant.id, entitlements });
    setSaving(false);
    setMessage(result.error || 'Entitlements saved and projected to feature flags.');
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
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={sync} disabled={saving}>{saving ? 'Syncing...' : 'Sync entitlements'}</PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
