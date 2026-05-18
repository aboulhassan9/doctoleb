import { useEffect, useMemo, useState } from 'react';
import { Stethoscope, Loader2, Save } from 'lucide-react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import {
  Badge,
  Card,
  CardContent,
  CardFooter,
  Field,
  FormMessage,
  PrimaryButton,
  SettingsSection,
  TextInput,
} from './ui';

function latestProvisioningJob(tenant) {
  return (
    [...(tenant?.tenant_provisioning_jobs || [])].sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
    )[0] || null
  );
}

export default function FirstDoctorAdminPanel({ tenant, onSaved }) {
  const job = useMemo(() => latestProvisioningJob(tenant), [tenant]);
  const [displayName, setDisplayName] = useState(job?.first_doctor_display_name || '');
  const [email, setEmail] = useState(job?.first_doctor_email || '');
  const [phone, setPhone] = useState(job?.first_doctor_phone || '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(job?.first_doctor_display_name || '');
    setEmail(job?.first_doctor_email || '');
    setPhone(job?.first_doctor_phone || '');
    setMessage('');
  }, [job?.id, job?.first_doctor_display_name, job?.first_doctor_email, job?.first_doctor_phone]);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const result = await controlPlaneApi.updateFirstDoctorAdmin({
        tenantId: tenant.id,
        displayName,
        email,
        phone,
      });
      setMessage(
        result.error ? result.details?.summary || result.error : 'Doctor login saved. OTP uses this email.',
      );
      if (!result.error) onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!job) return null;

  return (
    <SettingsSection
      title="First Doctor Admin"
      description="Doctor login credentials"
      icon={Stethoscope}
      headerAction={<Badge variant="accent">Email OTP</Badge>}
    >
      <Card>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Doctor name">
              <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </Field>
            <Field label="Login email">
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Phone">
              <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-3">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Doctor Login'}
          </PrimaryButton>
          {message && (
            <FormMessage tone={message.includes('saved') ? 'success' : 'error'}>{message}</FormMessage>
          )}
        </CardFooter>
      </Card>
    </SettingsSection>
  );
}
