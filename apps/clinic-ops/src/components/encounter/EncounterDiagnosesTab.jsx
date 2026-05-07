import { useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

export default function EncounterDiagnosesTab({ diagnoses, loading, isSaving, onAddDiagnosis, encounterId, patientId, doctorId, recordedBy, isActive = false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ diagnosis_text: '', icd10_code: '', diagnosis_type: 'primary', status: 'active', notes: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.diagnosis_text.trim()) return;
    const success = await onAddDiagnosis({
      encounter_id: encounterId, patient_id: patientId, doctor_id: doctorId, recorded_by: recordedBy,
      diagnosis_text: form.diagnosis_text.trim(), icd10_code: form.icd10_code.trim() || null,
      diagnosis_type: form.diagnosis_type, status: form.status, notes: form.notes.trim() || null,
    });
    if (success) { setForm({ diagnosis_text: '', icd10_code: '', diagnosis_type: 'primary', status: 'active', notes: '' }); setShowForm(false); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {isActive && !showForm && (
        <button onClick={() => setShowForm(true)} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>Add Diagnosis
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Diagnosis</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Diagnosis *</label>
              <input type="text" value={form.diagnosis_text} onChange={(e) => setForm({ ...form, diagnosis_text: e.target.value })} placeholder="e.g. Type 2 Diabetes Mellitus" className={INPUT_CLASS} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">ICD-10 Code</label>
              <input type="text" value={form.icd10_code} onChange={(e) => setForm({ ...form, icd10_code: e.target.value })} placeholder="e.g. E11.9" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
              <select value={form.diagnosis_type} onChange={(e) => setForm({ ...form, diagnosis_type: e.target.value })} className={INPUT_CLASS}>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="differential">Differential</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={2} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
            <button type="submit" disabled={!form.diagnosis_text.trim() || isSaving} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
              {isSaving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}Save
            </button>
          </div>
        </form>
      )}
      {diagnoses.length === 0 ? (
        <EmptyState icon="diagnosis" title="No diagnoses recorded" subtitle="Add a diagnosis to document conditions." />
      ) : (
        <div className="space-y-3">
          {diagnoses.map((dx) => (
            <div key={dx.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-slate-900">{dx.diagnosis_text || dx.diseases?.name || 'Unnamed'}</h4>
                <StatusBadge status={dx.status} size="sm" />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                {dx.icd10_code && <span className="font-mono font-bold text-slate-500">{dx.icd10_code}</span>}
                <span className="capitalize">{dx.diagnosis_type}</span>
              </div>
              {dx.notes && <p className="text-xs text-slate-500 mt-2">{dx.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
