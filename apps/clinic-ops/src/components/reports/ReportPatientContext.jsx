import {
  getPatientIdentitySummary,
  sanitizeClinicalReportText,
} from '@core/lib/clinicalReportBuilder';

function formatDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportPatientContext({
  patient,
  encounters = [],
  selectedEncounterId = '',
  diagnoses = [],
  prescriptions = [],
  onEncounterChange,
  onOpenTimeline,
  onInsert,
}) {
  const identity = getPatientIdentitySummary(patient);
  if (!identity) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-bold text-slate-500">Select a patient to load report context, old reports, diagnoses, medications, and visit history.</p>
      </section>
    );
  }

  const activeDiagnoses = diagnoses
    .map((item) => sanitizeClinicalReportText(item.diagnosis_text || item.diseases?.name))
    .filter(Boolean)
    .slice(0, 4);
  const activeMeds = prescriptions
    .map((item) => sanitizeClinicalReportText([item.medication_name, item.dosage, item.frequency].filter(Boolean).join(' • ')))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">2. Context</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Patient-aware report workspace</h2>
          <p className="mt-1 text-xs text-slate-500">Use verified chart data instead of retyping from memory.</p>
        </div>
        <button
          type="button"
          onClick={onOpenTimeline}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-primary hover:text-primary"
        >
          Open patient timeline
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Identity</p>
          <p className="mt-1 text-sm font-black text-slate-900">{identity.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {identity.dateOfBirth || 'DOB unknown'}{identity.age !== null ? ` • ${identity.age}y` : ''}{identity.sex ? ` • ${identity.sex}` : ''}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Risk signals</p>
          <p className="mt-1 text-xs font-bold text-slate-700">Blood: {identity.bloodType || '—'}</p>
          <p className="mt-1 text-xs font-bold text-slate-700">Allergies: {identity.allergies}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Recent chart data</p>
          <p className="mt-1 text-xs font-bold text-slate-700">{diagnoses.length} diagnoses • {prescriptions.length} prescriptions</p>
          <p className="mt-1 text-xs font-bold text-slate-700">{encounters.length} recent encounters loaded</p>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="report-source-encounter" className="text-[10px] font-black uppercase tracking-wider text-slate-500">Source visit / encounter</label>
        <select
          id="report-source-encounter"
          value={selectedEncounterId}
          onChange={(event) => onEncounterChange(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-primary focus:ring-4 focus:ring-primary/10"
        >
          <option value="">No source encounter linked yet</option>
          {encounters.map((encounter) => (
            <option key={encounter.id} value={encounter.id}>
              {formatDate(encounter.started_at || encounter.created_at)} — {sanitizeClinicalReportText(encounter.chief_complaint || encounter.summary || encounter.status || 'Clinical encounter')}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Diagnoses</p>
            <button
              type="button"
              onClick={() => onInsert('diagnosisSummary')}
              disabled={!activeDiagnoses.length}
              title={activeDiagnoses.length ? 'Insert current diagnoses into the report.' : 'No diagnoses are available to insert.'}
              className="text-[11px] font-black text-primary hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
            >
              Insert
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">{activeDiagnoses.join('; ') || 'No diagnosis data found for this patient.'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active medication</p>
            <button
              type="button"
              onClick={() => onInsert('activeMedications')}
              disabled={!activeMeds.length}
              title={activeMeds.length ? 'Insert active medications into the report.' : 'No active medications are available to insert.'}
              className="text-[11px] font-black text-primary hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
            >
              Insert
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-xs text-slate-600">{activeMeds.join('\n') || 'No active prescriptions found.'}</p>
        </div>
      </div>
    </section>
  );
}
