import { useEffect, useState } from 'react';
import { FEATURE_CATALOG } from '../data/saasCatalog';
import {
  buildManualEntitlementSyncPayload,
  resolveEffectiveEntitlementState,
  resolvePlanEntitlementState,
} from '../lib/entitlementDrafts';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { Badge, Button, Card, CardContent, CardFooter, FormMessage, SettingsSection } from './ui';
import { ShieldCheck, ArrowRightLeft, Check, Loader2 } from 'lucide-react';

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
    setEnabled(
      resolveEffectiveEntitlementState({
        planCode: tenant.plan,
        planEntitlements,
        tenantEntitlements: existing,
        features: FEATURE_CATALOG,
      }),
    );
    setMessage('');
  }, [tenant.id, tenant.plan, planEntitlements]);

  async function sync() {
    if (!hasRuntimeConfig) {
      setMessage('Save the tenant runtime connection before projecting feature flags.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = buildManualEntitlementSyncPayload({
        desiredState: enabled,
        planState,
        tenantEntitlements: existing,
        features: FEATURE_CATALOG,
      });
      const result = await controlPlaneApi.syncEntitlements({ tenantId: tenant.id, ...payload });
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage('Entitlements saved and projected successfully.');
        onSaved();
      }
    } catch (e) {
      setMessage('An unexpected error occurred during sync.');
    } finally {
      setSaving(false);
    }
  }

  const overridesCount = FEATURE_CATALOG.filter((f) => enabled[f.code] !== planState[f.code]).length;
  const isError = message.includes('error') || message.includes('unexpected');

  return (
    <SettingsSection
      title="Feature Entitlements"
      description={`Manage premium capabilities and tier overrides for ${tenant.name}`}
      icon={ShieldCheck}
      headerAction={
        overridesCount > 0 && (
          <Badge variant="warning">
            {overridesCount} Active Override{overridesCount !== 1 ? 's' : ''}
          </Badge>
        )
      }
    >
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {FEATURE_CATALOG.map((feature) => {
              const isEnabled = enabled[feature.code] === true;
              const isOverride = enabled[feature.code] !== planState[feature.code];

              return (
                <li key={feature.code}>
                  <label
                    className={`flex cursor-pointer items-start gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50 ${
                      isEnabled ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(event) =>
                        setEnabled((current) => ({ ...current, [feature.code]: event.target.checked }))
                      }
                      className="sr-only"
                    />
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isEnabled
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      {isEnabled && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>

                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-medium ${isEnabled ? 'text-slate-900' : 'text-slate-700'}`}>
                          {feature.label}
                        </span>
                        {isOverride && <Badge variant="warning">Override</Badge>}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-slate-500">{feature.description}</span>
                      {!isOverride && (
                        <span className="mt-2 inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {planState[feature.code] ? 'Enabled by plan' : 'Disabled by plan'}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </CardContent>

        <CardFooter className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!hasRuntimeConfig ? (
            <FormMessage tone="warning">Runtime connection required first.</FormMessage>
          ) : message ? (
            <FormMessage tone={isError ? 'error' : 'success'}>{message}</FormMessage>
          ) : (
            <FormMessage tone="info">Changes apply immediately across the tenant's environment.</FormMessage>
          )}
          <Button onClick={sync} disabled={saving || !hasRuntimeConfig} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            {saving ? 'Syncing...' : 'Sync Entitlements'}
          </Button>
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
