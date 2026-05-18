import { useEffect, useState } from 'react';
import { patientService } from '@/services/patients';
import { getPatientIdentitySummary } from '@core/lib/clinicalReportBuilder';

function formatIdentityLine(patient) {
  const identity = getPatientIdentitySummary(patient);
  if (!identity) return 'No patient selected';
  return [
    identity.dateOfBirth ? `DOB ${identity.dateOfBirth}` : null,
    identity.age !== null ? `${identity.age}y` : null,
    identity.sex || null,
    identity.phone || null,
  ].filter(Boolean).join(' • ') || 'No identifiers recorded';
}

export default function PatientReportPicker({ selectedPatient, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data, error: searchError } = await patientService.search(trimmed);
      if (cancelled) return;
      if (searchError) {
        setError(String(searchError.message || searchError || 'Patient search failed'));
        setResults([]);
      } else {
        setError('');
        setResults((data || []).slice(0, 12));
      }
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedIdentity = getPatientIdentitySummary(selectedPatient);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-primary">1. Patient</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Choose the exact patient</h2>
          <p className="mt-1 text-xs text-slate-500">Search by name, phone, or email. No patient is selected automatically.</p>
        </div>
        {selectedIdentity ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
            Confirmed
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="report-patient-search" className="sr-only">Search patients</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
          <input
            id="report-patient-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
            placeholder="Search patient by name, phone, or email..."
            autoComplete="off"
          />
        </div>
      </div>

      {selectedIdentity ? (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-white">
              {selectedIdentity.initials || 'P'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-slate-950">{selectedIdentity.name}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{formatIdentityLine(selectedPatient)}</p>
              <p className="mt-2 text-xs text-slate-500">
                Allergies: <span className="font-bold text-slate-700">{selectedIdentity.allergies}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary"
            >
              Change
            </button>
          </div>
        </div>
      ) : null}

      {query.trim().length >= 2 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm font-semibold text-slate-500">Searching patients...</div>
          ) : error ? (
            <div className="p-4 text-sm font-semibold text-red-600">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm font-semibold text-slate-500">No matching patients found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((patient) => {
                const identity = getPatientIdentitySummary(patient);
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      onSelect(patient);
                      setQuery('');
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                      {identity?.initials || 'P'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{identity?.name || 'Unnamed patient'}</p>
                      <p className="truncate text-xs text-slate-500">{formatIdentityLine(patient)}</p>
                    </div>
                    <span className="material-symbols-outlined text-lg text-slate-300">chevron_right</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
