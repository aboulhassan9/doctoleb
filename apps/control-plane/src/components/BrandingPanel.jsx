import { useEffect, useState } from 'react';
import { DEFAULT_BRANDING } from '../data/saasCatalog';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { Field, TextInput, PrimaryButton } from './ui';

export default function BrandingPanel({ tenant }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const hasRuntimeConfig = Boolean(tenant.supabase_project_ref && tenant.supabase_url);

  useEffect(() => {
    setBranding({
      ...DEFAULT_BRANDING,
      display_name: tenant.display_name || DEFAULT_BRANDING.display_name,
      app_name: tenant.display_name || DEFAULT_BRANDING.app_name,
    });
    setMessage('');
  }, [tenant.id, tenant.display_name]);

  function updateField(key, value) {
    setBranding((current) => ({ ...current, [key]: value }));
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
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Branding</p>
      <h2 className="mt-2 text-2xl font-black">Tenant theme projection</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Display name">
          <TextInput value={branding.display_name} onChange={(event) => updateField('display_name', event.target.value)} />
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
