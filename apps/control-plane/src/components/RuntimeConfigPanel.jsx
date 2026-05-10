import { useEffect, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import {
  buildSupabaseUrl,
  normalizeSupabaseProjectRef,
  normalizeSupabaseUrl,
  validateRuntimeConfigDraft,
} from '../lib/runtimeConfigDrafts';
import { Field, TextInput, PrimaryButton } from './ui';

const RUNTIME_CONFIG_SOURCE_HELP =
  'In the tenant Supabase project, copy the project ref from the project URL, copy the API URL from Data API, and copy the browser-safe publishable/anon key from Settings -> API Keys. Do not paste the secret/service key here.';

export default function RuntimeConfigPanel({ tenant, onSaved }) {
  const [projectRef, setProjectRef] = useState(tenant.supabase_project_ref || '');
  const [supabaseUrl, setSupabaseUrl] = useState(tenant.supabase_url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProjectRef(tenant.supabase_project_ref || '');
    setSupabaseUrl(tenant.supabase_url || '');
    setSupabaseAnonKey('');
    setMessage('');
  }, [tenant.id, tenant.supabase_project_ref, tenant.supabase_url]);

  function updateProjectRef(value) {
    const nextProjectRef = normalizeSupabaseProjectRef(value);
    setProjectRef(nextProjectRef);
    if (!supabaseUrl || supabaseUrl === buildSupabaseUrl(projectRef)) {
      setSupabaseUrl(buildSupabaseUrl(nextProjectRef));
    }
  }

  async function save() {
    const validationError = validateRuntimeConfigDraft({ projectRef, supabaseUrl, supabaseAnonKey });
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    const result = await controlPlaneApi.setTenantRuntimeConfig({
      tenantId: tenant.id,
      supabaseProjectRef: projectRef,
      supabaseUrl,
      supabaseAnonKey,
    });
    setSaving(false);
    setMessage(result.error || 'Tenant runtime connection saved.');
    if (!result.error) {
      setSupabaseAnonKey('');
      onSaved();
    }
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Runtime connection</p>
      <h2 className="mt-2 text-2xl font-black">Tenant Supabase project</h2>
      <p className="mt-2 text-sm text-slate-500">
        Stores public resolver metadata only. Tenant service-role keys stay in Edge Function secrets or Vault, never in this form.
      </p>
      <div className="mt-4 rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-950 ring-1 ring-cyan-100">
        <p className="font-black">Where to find these values</p>
        <p className="mt-1 font-semibold text-cyan-900">{RUNTIME_CONFIG_SOURCE_HELP}</p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="Project ref">
          <TextInput value={projectRef} onChange={(event) => updateProjectRef(event.target.value)} />
        </Field>
        <Field label="Supabase URL">
          <TextInput value={supabaseUrl} onChange={(event) => setSupabaseUrl(normalizeSupabaseUrl(event.target.value))} />
        </Field>
        <Field label="Tenant anon key">
          <TextInput autoComplete="off" value={supabaseAnonKey} onChange={(event) => setSupabaseAnonKey(event.target.value.trim())} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save runtime config'}</PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
