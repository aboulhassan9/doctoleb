import { useEffect, useState } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { PLAN_OPTIONS, TENANT_STATUSES } from '../data/saasCatalog';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import {
  Card,
  CardContent,
  CardFooter,
  Field,
  FormMessage,
  PrimaryButton,
  SelectInput,
  SettingsSection,
  StatusPill,
  TextInput,
} from './ui';

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
      patch: { display_name: displayName, status, plan },
    });
    setSaving(false);
    setMessage(result.error || 'Tenant metadata saved.');
    if (!result.error) onSaved();
  }

  return (
    <SettingsSection
      title={tenant.display_name}
      description={`Project ref: ${tenant.supabase_project_ref || 'Not configured yet'}`}
      icon={Building2}
      headerAction={<StatusPill value={tenant.status} />}
    >
      <Card>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Display name">
              <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </Field>
            <Field label="Status">
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
                {TENANT_STATUSES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Plan">
              <SelectInput value={plan} onChange={(event) => setPlan(event.target.value)}>
                {PLAN_OPTIONS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Tenant'}
          </PrimaryButton>
          {message && (
            <FormMessage tone={message.includes('saved') ? 'success' : 'error'}>{message}</FormMessage>
          )}
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
