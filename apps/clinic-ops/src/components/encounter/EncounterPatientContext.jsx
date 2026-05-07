import { StatusBadge } from '@/components/ui';

/**
 * EncounterPatientContext — Read-only patient summary card within the encounter.
 *
 * Displays patient demographics, contact info, intake status, visit type, and location.
 * Data is derived from the encounter's joined relations — no direct DB calls.
 *
 * @param {{ encounter: object, patient: object }} props
 */
export default function EncounterPatientContext({
  encounter,
  patient,
  previousEncounters = [],
  historyLoading = false,
}) {
  if (!patient) {
    return (
      <div className="text-center py-12 text-slate-400">
        <span className="material-symbols-outlined text-4xl mb-2 block">person_off</span>
        <p className="text-sm font-medium">No patient data available.</p>
      </div>
    );
  }

  const user = patient.users || {};
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown Patient';
  const initials = `${(user.first_name || '?')[0]}${(user.last_name || '?')[0]}`.toUpperCase();
  const clinic = encounter?.clinics || null;
  const visitType = encounter?.visit_types || null;
  const priorVisits = previousEncounters
    .filter((item) => item.id !== encounter?.id)
    .slice(0, 3);

  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null;

  return (
    <div className="space-y-6">
      {/* Patient Identity Card */}
      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-slate-900">{fullName}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {patient.sex && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {patient.sex}
              </span>
            )}
            {age !== null && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {age} years
              </span>
            )}
            {patient.blood_type && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {patient.blood_type}
              </span>
            )}
            {patient.intake_completed_at ? (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ Intake Complete
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                ⚠ Intake Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact & Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailItem icon="email" label="Email" value={user.email} />
        <DetailItem icon="phone" label="Phone" value={user.phone} />
        <DetailItem icon="cake" label="Date of Birth" value={patient.date_of_birth ? formatDate(patient.date_of_birth) : null} />
        <DetailItem icon="badge" label="Insurance ID" value={patient.insurance_id} />
        <DetailItem icon="emergency" label="Emergency Contact" value={patient.emergency_contact} />
        <DetailItem icon="call" label="Emergency Phone" value={patient.emergency_phone} />
      </div>

      {/* Allergies Banner */}
      {patient.allergies && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Known Allergies</span>
          </div>
          <p className="text-sm text-amber-800">{patient.allergies}</p>
        </div>
      )}

      {/* Visit Context */}
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Current Visit</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {visitType && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Visit Type</p>
              <p className="text-sm font-semibold text-slate-800">{visitType.name || visitType.code}</p>
            </div>
          )}
          {clinic && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Location</p>
              <p className="text-sm font-semibold text-slate-800">{clinic.name}</p>
              {clinic.location_type && (
                <span className="text-[10px] font-medium text-slate-500 capitalize">{clinic.location_type.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}
          {encounter?.started_at && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Started</p>
              <p className="text-sm font-semibold text-slate-800">{formatDateTime(encounter.started_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Previous Encounters */}
      <div className="rounded-xl bg-white border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Previous Visits</h4>
          {historyLoading && <span className="text-[10px] font-semibold text-slate-400">Loading...</span>}
        </div>
        {priorVisits.length === 0 ? (
          <p className="text-sm text-slate-400">No previous encounters recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {priorVisits.map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {visit.chief_complaint || visit.summary || 'Clinical encounter'}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400">
                    {formatDateTime(visit.started_at || visit.created_at)}
                  </p>
                </div>
                <StatusBadge status={visit.status} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
      <div>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function calculateAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function formatDateTime(dateString) {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
