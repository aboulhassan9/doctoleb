import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Edit3, Save, ShieldAlert, UserRound, X } from 'lucide-react';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { patientService } from '@core/services/patients';
import { patientFormsService } from '@core/services/patientForms';
import { PATIENT_FORM_CONTEXTS, resolvePatientFormDefinition } from '@core/lib/patientForms';
import { logError } from '@core/lib/logger';
import { getUserInitials } from '@core/lib/userDisplay';
import { PatientPortalShell } from '@ui/components/patient/PatientPortalShell';
import { PatientIntakeField } from '@ui/components/patient/PatientIntakeField';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

const PROFILE_KEYS = [
  'first_name',
  'last_name',
  'phone',
  'date_of_birth',
  'sex',
  'blood_type',
  'allergies',
  'insurance_id',
  'emergency_contact',
  'emergency_phone',
  'medical_history',
];

function buildProfileForm({ user, patient }) {
  return {
    first_name: user?.first_name || patient?.users?.first_name || '',
    last_name: user?.last_name || patient?.users?.last_name || '',
    phone: user?.phone || patient?.users?.phone || '',
    date_of_birth: patient?.date_of_birth || '',
    sex: patient?.sex || '',
    blood_type: patient?.blood_type || '',
    allergies: patient?.allergies || '',
    insurance_id: patient?.insurance_id || '',
    emergency_contact: patient?.emergency_contact || '',
    emergency_phone: patient?.emergency_phone || '',
    medical_history: patient?.medical_history || '',
  };
}

function buildProfilePayload(form) {
  return Object.fromEntries(PROFILE_KEYS.map((key) => {
    const value = typeof form[key] === 'string' ? form[key].trim() : form[key];
    return [key, value || null];
  }));
}

function validateRequired({ definition, form }) {
  for (const key of definition.requiredKeys || []) {
    if (!PROFILE_KEYS.includes(key)) continue;
    if (!String(form[key] || '').trim()) {
      const field = definition.fields.find((item) => item.key === key);
      return `${field?.label || key} is required.`;
    }
  }
  return null;
}

function ProfileSummary({ user, patient, isEditing, onEdit, onCancel, onSave, submitting }) {
  const patientRef = patient?.id ? `PAT-${String(patient.id).replace(/-/g, '').slice(0, 10).toUpperCase()}` : 'Pending profile';
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Patient profile';

  return (
    <motion.section variants={patientFadeRise} className="patient-paper-strong patient-surface relative overflow-hidden p-6">
      <div aria-hidden="true" className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--patient-success)_45%,transparent)] blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5">
          <span className="grid h-20 w-20 place-items-center rounded-[22px_6px_22px_6px] bg-[var(--patient-sage)] text-2xl font-black text-white">
            {getUserInitials(user)}
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--patient-sage)]">Patient identity</p>
            <h1
              className="patient-display mt-2 text-4xl font-medium tracking-tight text-[var(--patient-ink)]"
              aria-label={`My Profile - ${displayName}`}
            >
              {displayName}
            </h1>
            <p className="mt-2 font-mono text-xs font-bold text-[color-mix(in_srgb,var(--patient-muted)_75%,transparent)]">{patientRef}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="patient-button-secondary px-5 py-3"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={submitting}
                className="patient-button-primary px-5 py-3 disabled:bg-[var(--patient-outline)]"
              >
                <Save className="h-4 w-4" />
                {submitting ? 'Saving...' : 'Save changes'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="patient-button-primary px-5 py-3"
            >
              <Edit3 className="h-4 w-4" />
              Edit profile
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export default function PatientOwnProfilePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [patient, setPatient] = useState(null);
  const [definition, setDefinition] = useState(() => resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.profile }));
  const [configWarning, setConfigWarning] = useState('');
  const [formData, setFormData] = useState(() => buildProfileForm({ user, patient: null }));
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const visibleFields = useMemo(
    () => (definition.fields || []).filter((field) => PROFILE_KEYS.includes(field.key)),
    [definition.fields]
  );

  const sections = useMemo(() => {
    return (definition.sections || [])
      .map((section) => ({
        ...section,
        fields: visibleFields.filter((field) => field.section === section.id),
      }))
      .filter((section) => section.fields.length > 0);
  }, [definition.sections, visibleFields]);

  const fetchPatientProfile = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await patientService.getByUserId(user.id);
      if (error || !data) {
        showToast(error || 'Failed to load profile', 'error');
        return;
      }

      const definitionResult = await patientFormsService.getDefinition({
        context: PATIENT_FORM_CONTEXTS.profile,
        patientId: data.id,
      });

      setPatient(data);
      setFormData(buildProfileForm({ user, patient: data }));
      setDefinition(definitionResult.data || resolvePatientFormDefinition({ context: PATIENT_FORM_CONTEXTS.profile }));
      setConfigWarning(definitionResult.configError || '');
    } catch (err) {
      logError('PatientOwnProfilePage.fetchPatientProfile', err);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPatientProfile();
  }, [user?.id]);

  const updateField = (key, value) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProfile = async () => {
    const requiredError = validateRequired({ definition, form: formData });
    if (requiredError) {
      showToast(requiredError, 'error');
      return;
    }

    const sanitizedPhone = formData.phone?.trim();
    if (sanitizedPhone && !/^\+?[\d\s-]{8,20}$/.test(sanitizedPhone)) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }

    if (formData.emergency_phone && !/^\+?[\d\s-]{8,20}$/.test(formData.emergency_phone)) {
      showToast('Please enter a valid emergency contact phone', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await patientService.updateOwnProfile({
        userId: user?.id,
        patientId: patient?.id,
        profile: buildProfilePayload(formData),
      });

      if (error) {
        showToast(error || 'Failed to update profile', 'error');
        return;
      }

      showToast('Profile updated successfully', 'success');
      setPatient(data || patient);
      setIsEditing(false);
      await fetchPatientProfile();
    } catch (err) {
      logError('PatientOwnProfilePage.handleSaveProfile', err);
      showToast('An error occurred while saving your profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PatientPortalShell title="Profile" subtitle="Identity, safety notes, and support contacts">
        <motion.section variants={patientStagger} initial="hidden" animate="visible" className="grid gap-8 lg:grid-cols-[0.9fr_1.2fr]">
          <div className="space-y-5">
            <ProfileSummary
              user={user}
              patient={patient}
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                setIsEditing(false);
                setFormData(buildProfileForm({ user, patient }));
              }}
              onSave={handleSaveProfile}
              submitting={submitting}
            />

            <motion.section variants={patientFadeRise} className="patient-paper patient-surface p-6">
              <ShieldAlert className="h-6 w-6 text-[var(--patient-clay)]" />
              <h2 className="patient-display mt-4 text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                Profile changes are clinical inputs.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                The page renders from the same allowlisted registry used by onboarding. Deep structured history remains staff-managed for this phase.
              </p>
            </motion.section>
          </div>

          <motion.form
            variants={patientFadeRise}
            className="patient-paper-strong patient-surface p-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (isEditing) void handleSaveProfile();
            }}
            aria-busy={loading || submitting}
          >
            <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--patient-outline)_60%,transparent)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">Editable profile</p>
                <h2 className="patient-display mt-2 text-4xl font-medium tracking-tight text-[var(--patient-ink)]">
                  What the clinic sees first
                </h2>
              </div>
              <span className="patient-status-sage">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Config-ready
              </span>
            </div>

            {configWarning ? (
              <p className="patient-inset-warning mt-5 px-4 py-3 text-sm font-black">
                {configWarning}
              </p>
            ) : null}

            {loading ? (
              <div className="mt-6 space-y-3" role="status">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-24 animate-pulse rounded-xl bg-[var(--patient-wash)]" />
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-8">
                {sections.map((section) => (
                  <section key={section.id}>
                    <div className="mb-4 flex items-center gap-3">
                      <UserRound className="h-4 w-4 text-[var(--patient-sage)]" />
                      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--patient-sage)]">
                        {section.title}
                      </h3>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      {section.fields.map((field) => (
                        <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <PatientIntakeField
                            field={field}
                            value={formData[field.key]}
                            onChange={updateField}
                            disabled={!isEditing || submitting}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </motion.form>
        </motion.section>
    </PatientPortalShell>
  );
}
