import { useEffect, useMemo, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { Field, TextInput, PrimaryButton } from './ui';

function latestProvisioningJob(tenant) {
  return [...(tenant?.tenant_provisioning_jobs || [])]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;
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

      setMessage(result.error ? (result.details?.summary || result.error) : 'Doctor login saved. OTP uses this email.');
      if (!result.error) onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!job) return null;

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-700">Doctor login</p>
          <h2 className="mt-2 text-2xl font-black">First doctor admin</h2>
        </div>
        <p className="rounded-full bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
          Email OTP
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
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
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save doctor login'}
        </PrimaryButton>
        {message ? <p className="text-sm font-semibold text-slate-500">{message}</p> : null}
      </div>
    </section>
  );
}
