import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge, SearchableSelect } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';
import { medicationCatalogService } from '@core/services/medicationCatalog';

/** Debounce delay for medication search (ms). */
const SEARCH_DEBOUNCE_MS = 200;

/** Minimum characters before triggering a catalog search. */
const MIN_SEARCH_CHARS = 2;

export default function EncounterPrescriptionsTab({
  prescriptions,
  loading,
  isSaving,
  onAddPrescription,
  encounterId,
  patientId,
  doctorId,
  prescribedBy,
  isActive = false,
  hasEncounterDiagnosis = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    medication_name: '',
    medication_catalog_id: null,
    dosage: '',
    route: '',
    frequency: '',
    duration: '',
    instructions: '',
  });

  // ── Medication autocomplete state ───────────────────────────────
  const [medQuery, setMedQuery] = useState('');
  const [medOptions, setMedOptions] = useState([]);
  const [medSearching, setMedSearching] = useState(false);
  const debounceRef = useRef(null);

  // Debounced search against medication catalog
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = medQuery.trim();
    if (trimmed.length < MIN_SEARCH_CHARS) {
      setMedOptions([]);
      setMedSearching(false);
      return;
    }

    setMedSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await medicationCatalogService.search(trimmed, { limit: 8 });
        if (!error && Array.isArray(data)) {
          setMedOptions(
            data.map((item) => ({
              value: item.id,
              label: item.name,
              hint: [
                ...(item.dosage_forms || []),
                item.generic_name ? `(${item.generic_name})` : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined,
              _raw: item,
            }))
          );
        } else {
          setMedOptions([]);
        }
      } catch {
        setMedOptions([]);
      } finally {
        setMedSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [medQuery]);

  // When user selects from the autocomplete dropdown
  const handleMedicationSelect = useCallback(
    (catalogId) => {
      if (!catalogId) {
        // Cleared selection — keep whatever they typed
        setForm((prev) => ({
          ...prev,
          medication_catalog_id: null,
        }));
        return;
      }

      const selected = medOptions.find((opt) => opt.value === catalogId);
      if (selected) {
        const raw = selected._raw;
        setForm((prev) => ({
          ...prev,
          medication_name: raw.name,
          medication_catalog_id: raw.id,
          // Prefill first dosage form if available and dosage is empty
          dosage:
            prev.dosage ||
            (Array.isArray(raw.dosage_forms) && raw.dosage_forms.length > 0
              ? raw.dosage_forms[0]
              : prev.dosage),
        }));
      }
    },
    [medOptions]
  );

  // Allow free-text entry when user types without selecting from catalog
  const handleMedQueryChange = useCallback((newQuery) => {
    setMedQuery(newQuery);
  }, []);

  const resetForm = () => {
    setForm({
      medication_name: '',
      medication_catalog_id: null,
      dosage: '',
      route: '',
      frequency: '',
      duration: '',
      instructions: '',
    });
    setMedQuery('');
    setMedOptions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const medName = form.medication_name.trim() || medQuery.trim();
    if (!medName) return;

    const success = await onAddPrescription({
      encounter_id: encounterId,
      patient_id: patientId,
      doctor_id: doctorId,
      prescribed_by: prescribedBy,
      medication_name: medName,
      medication_catalog_id: form.medication_catalog_id || null,
      dosage: form.dosage.trim() || null,
      route: form.route.trim() || null,
      frequency: form.frequency.trim() || null,
      duration: form.duration.trim() || null,
      instructions: form.instructions.trim() || null,
      status: 'active',
    });
    if (success) {
      resetForm();
      setShowForm(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {isActive && !hasEncounterDiagnosis && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Record a diagnosis for this encounter before adding prescriptions.
        </div>
      )}
      {isActive && !showForm && hasEncounterDiagnosis && (
        <button
          onClick={() => setShowForm(true)}
          className={`${BUTTON_PRIMARY} flex items-center gap-2`}
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Prescription
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Prescription</h4>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <SearchableSelect
                label="Medication"
                value={form.medication_catalog_id}
                options={medOptions}
                onChange={handleMedicationSelect}
                placeholder={medSearching ? 'Searching…' : 'Type to search medications…'}
                emptyMessage={
                  medQuery.length < MIN_SEARCH_CHARS
                    ? 'Type at least 2 characters…'
                    : medSearching
                      ? 'Searching…'
                      : 'No matches. The name will be added to the catalog on save.'
                }
                required
              />
              {/* Free-text fallback: if no catalog match selected, use query as medication_name */}
              {!form.medication_catalog_id && (
                <input
                  type="text"
                  value={form.medication_name || medQuery}
                  onChange={(e) => {
                    setForm({ ...form, medication_name: e.target.value, medication_catalog_id: null });
                    setMedQuery(e.target.value);
                  }}
                  placeholder="Or type medication name directly…"
                  className={`${INPUT_CLASS} mt-2`}
                />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Dosage</label>
              <input type="text" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500mg" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Route</label>
              <input type="text" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="e.g. Oral" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Frequency</label>
              <input type="text" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. 3x daily" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Duration</label>
              <input type="text" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 7 days" className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Instructions</label>
              <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Take with food..." rows={2} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className={BUTTON_SECONDARY}>Cancel</button>
            <button
              type="submit"
              disabled={!(form.medication_name.trim() || medQuery.trim()) || isSaving}
              className={`${BUTTON_PRIMARY} flex items-center gap-2`}
            >
              {isSaving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}Save
            </button>
          </div>
        </form>
      )}
      {prescriptions.length === 0 ? (
        <EmptyState icon="medication" title="No prescriptions" subtitle="Add medications prescribed during this encounter." />
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-lg">medication</span>
                <h4 className="text-sm font-bold text-slate-900">{rx.medication_name}</h4>
                <StatusBadge status={rx.status} size="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                {rx.dosage && <span>{rx.dosage}</span>}
                {rx.route && <span>• {rx.route}</span>}
                {rx.frequency && <span>• {rx.frequency}</span>}
                {rx.duration && <span>• {rx.duration}</span>}
              </div>
              {rx.instructions && <p className="text-xs text-slate-400 mt-2 italic">{rx.instructions}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
