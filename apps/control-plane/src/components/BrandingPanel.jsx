import { useEffect, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { buildTenantBrandingDraft, updateTenantBrandingDraft } from '../lib/tenantBrandingDrafts';
import { Field, TextInput, PrimaryButton } from './ui';

export default function BrandingPanel({ tenant, runtimeBranding = null, runtimeBrandingError = '', onSaved }) {
  const [branding, setBranding] = useState(() => buildTenantBrandingDraft({ tenant, runtimeBranding }));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const hasRuntimeConfig = Boolean(tenant.supabase_project_ref && tenant.supabase_url);

  useEffect(() => {
    setBranding(buildTenantBrandingDraft({ tenant, runtimeBranding }));
    setMessage('');
  }, [tenant.id, tenant.display_name, runtimeBranding]);

  function updateField(key, value) {
    setBranding((current) => updateTenantBrandingDraft(current, key, value));
  }

  async function sync() {
    if (!hasRuntimeConfig) {
      setMessage('Save the tenant runtime connection before syncing branding.');
      return;
    }

    setSaving(true);
    const result = await controlPlaneApi.syncTenantConfig({ tenantId: tenant.id, branding });
    setSaving(false);
    setMessage(result.error || 'Branding synced to tenant runtime config.');
    if (!result.error) onSaved?.();
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Branding</p>
      <h2 className="mt-2 text-2xl font-black">Live tenant brand</h2>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        This writes the tenant database runtime config. Patient web, doctor/staff web, and future Flutter shells read this data at runtime, without a redeploy.
      </p>
      <div className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-900">
        {runtimeBranding ? 'Loaded from the tenant runtime database.' : 'Using SaaS fallback values until runtime branding can be read.'}
        {runtimeBrandingError ? <span className="block text-cyan-800">Runtime read status: {runtimeBrandingError}</span> : null}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Practice display name">
          <TextInput value={branding.display_name} onChange={(event) => updateField('display_name', event.target.value)} />
        </Field>
        <Field label="App name shown on patient and staff apps">
          <TextInput value={branding.app_name} onChange={(event) => updateField('app_name', event.target.value)} />
        </Field>
        <Field label="Tagline">
          <TextInput value={branding.app_tagline} onChange={(event) => updateField('app_tagline', event.target.value)} />
        </Field>
        <Field label="Primary color">
          <TextInput value={branding.primary_color} onChange={(event) => updateField('primary_color', event.target.value)} />
        </Field>
        <Field label="Secondary color">
          <TextInput value={branding.secondary_color} onChange={(event) => updateField('secondary_color', event.target.value)} />
        </Field>
        <Field label="Logo URL">
          <TextInput value={branding.splash_logo_url} onChange={(event) => updateField('splash_logo_url', event.target.value)} />
        </Field>
        <Field label="Support email">
          <TextInput value={branding.support_email} onChange={(event) => updateField('support_email', event.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={sync} disabled={saving || !hasRuntimeConfig}>{saving ? 'Syncing...' : 'Sync branding'}</PrimaryButton>
        {!hasRuntimeConfig ? <p className="text-sm font-semibold text-slate-500">Runtime connection required first.</p> : null}
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
