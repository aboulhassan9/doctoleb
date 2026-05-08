import { useEffect, useState } from 'react';
import { PLAN_OPTIONS, TENANT_STATUSES } from '../data/saasCatalog';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { Field, TextInput, SelectInput, PrimaryButton, StatusPill } from './ui';

export default function TenantControls({ tenant, onSaved }) {
  const [displayName, setDisplayName] = useState(tenant.display_name || '');
  const [status, setStatus] = useState(tenant.status || 'provisioning');
  const [plan, setPlan] = useState(tenant.plan || 'starter');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(tenant.display_name || '');
    setStatus(tenant.status || 'provisioning');
    setPlan(tenant.plan || 'starter');
    setMessage('');
  }, [tenant.id, tenant.display_name, tenant.plan, tenant.status]);

  async function save() {
    setSaving(true);
    const result = await controlPlaneApi.updateTenant({
      tenantId: tenant.id,
      patch: {
        display_name: displayName,
        status,
        plan,
      },
    });
    setSaving(false);
    setMessage(result.error || 'Tenant metadata saved.');
    if (!result.error) onSaved();
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Tenant control</p>
          <h2 className="mt-2 text-2xl font-black">{tenant.display_name}</h2>
          <p className="text-sm text-slate-500">Project ref: {tenant.supabase_project_ref || 'Not configured yet'}</p>
        </div>
        <StatusPill value={tenant.status} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Field label="Display name">
          <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field label="Status">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
            {TENANT_STATUSES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Plan">
          <SelectInput value={plan} onChange={(event) => setPlan(event.target.value)}>
            {PLAN_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save tenant'}</PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
