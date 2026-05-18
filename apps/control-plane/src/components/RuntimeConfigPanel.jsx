import { useEffect, useState } from 'react';
import { Database, Loader2, Save, Info } from 'lucide-react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import {
  buildSupabaseUrl,
  normalizeSupabaseProjectRef,
  normalizeSupabaseUrl,
  validateRuntimeConfigDraft,
} from '../lib/runtimeConfigDrafts';
import {
  Card,
  CardContent,
  CardFooter,
  Field,
  FormMessage,
  PrimaryButton,
  SettingsSection,
  TextInput,
} from './ui';

const RUNTIME_CONFIG_SOURCE_HELP =
  'In the tenant Supabase project, copy the project ref from the project URL, copy the API URL from Data API, and copy the browser-safe publishable/anon key from Settings -> API Keys. Do not paste any privileged key here.';

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
    <SettingsSection
      title="Tenant Supabase Project"
      description="Stores public resolver metadata only. Tenant privileged keys stay in Edge Function secrets or Vault, never in this form."
      icon={Database}
    >
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Where to find these values</h3>
              <p className="text-sm leading-relaxed text-slate-500">{RUNTIME_CONFIG_SOURCE_HELP}</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Project ref">
              <TextInput
                value={projectRef}
                onChange={(event) => updateProjectRef(event.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Supabase URL">
              <TextInput
                value={supabaseUrl}
                onChange={(event) => setSupabaseUrl(normalizeSupabaseUrl(event.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="Tenant anon key">
              <TextInput
                autoComplete="off"
                value={supabaseAnonKey}
                onChange={(event) => setSupabaseAnonKey(event.target.value.trim())}
                className="font-mono"
              />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Runtime Config'}
          </PrimaryButton>
          {message && (
            <FormMessage tone={message.includes('saved') ? 'success' : 'error'}>{message}</FormMessage>
          )}
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
