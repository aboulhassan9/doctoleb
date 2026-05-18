import { useEffect, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { buildTenantBrandingDraft, updateTenantBrandingDraft } from '../lib/tenantBrandingDrafts';
import BrandPreviewCard from './BrandPreviewCard';
import { Button, Card, CardContent, CardFooter, Field, FormMessage, SettingsSection, TextInput } from './ui';
import { Palette, CheckCircle2, Info, AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';

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
    setMessage('');
    try {
      const result = await controlPlaneApi.syncTenantConfig({ tenantId: tenant.id, branding });
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage('Branding synced to tenant runtime config successfully.');
        onSaved?.();
      }
    } catch (e) {
      setMessage('An unexpected error occurred during sync.');
    } finally {
      setSaving(false);
    }
  }

  const isError = message.includes('error') || message.includes('unexpected');

  return (
    <SettingsSection
      title="Live Tenant Brand"
      description={`Configure the visual identity for ${tenant.name}. Changes reflect across patient and staff apps.`}
      icon={Palette}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            {runtimeBranding ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-slate-900">
                {runtimeBranding ? 'Configuration loaded from runtime database' : 'Using SaaS fallback values'}
              </p>
              <p className="text-sm text-slate-500">
                {runtimeBranding
                  ? 'The current values below match the live tenant instance.'
                  : 'Default values are shown until runtime branding is synced or read.'}
              </p>
              {runtimeBrandingError && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Read error: {runtimeBrandingError}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
            <div className="grid content-start gap-5 sm:grid-cols-2">
              <Field label="Practice display name">
                <TextInput
                  value={branding.display_name}
                  onChange={(e) => updateField('display_name', e.target.value)}
                  placeholder="e.g. Acme Health Clinic"
                />
              </Field>
              <Field label="App name (Patient & Staff)">
                <TextInput
                  value={branding.app_name}
                  onChange={(e) => updateField('app_name', e.target.value)}
                  placeholder="e.g. AcmeCare"
                />
              </Field>
              <Field label="Tagline">
                <TextInput
                  value={branding.app_tagline}
                  onChange={(e) => updateField('app_tagline', e.target.value)}
                  placeholder="e.g. Better care, anywhere."
                />
              </Field>
              <Field label="Support email">
                <TextInput
                  type="email"
                  value={branding.support_email}
                  onChange={(e) => updateField('support_email', e.target.value)}
                  placeholder="support@acme.com"
                />
              </Field>

              <div className="grid gap-5 border-t border-slate-100 pt-5 sm:col-span-2 sm:grid-cols-2">
                <Field label="Primary color (Hex)">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-9 w-9 shrink-0 rounded-md border border-slate-200"
                      style={{ backgroundColor: branding.primary_color || '#e2e8f0' }}
                    />
                    <TextInput
                      value={branding.primary_color}
                      onChange={(e) => updateField('primary_color', e.target.value)}
                      placeholder="#0F172A"
                      className="font-mono"
                    />
                  </div>
                </Field>
                <Field label="Secondary color (Hex)">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-9 w-9 shrink-0 rounded-md border border-slate-200"
                      style={{ backgroundColor: branding.secondary_color || '#e2e8f0' }}
                    />
                    <TextInput
                      value={branding.secondary_color}
                      onChange={(e) => updateField('secondary_color', e.target.value)}
                      placeholder="#F8FAFC"
                      className="font-mono"
                    />
                  </div>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Logo URL">
                    <TextInput
                      value={branding.splash_logo_url}
                      onChange={(e) => updateField('splash_logo_url', e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-5 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Live Preview
              </h3>
              <div className="sticky top-6">
                <BrandPreviewCard branding={branding} />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!hasRuntimeConfig ? (
            <FormMessage tone="warning">Runtime connection required first.</FormMessage>
          ) : message ? (
            <FormMessage tone={isError ? 'error' : 'success'}>{message}</FormMessage>
          ) : (
            <FormMessage tone="info">Ready to sync branding configuration.</FormMessage>
          )}
          <Button onClick={sync} disabled={saving || !hasRuntimeConfig} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            {saving ? 'Syncing...' : 'Sync Branding'}
          </Button>
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
