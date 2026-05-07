import { useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

export default function EncounterPrescriptionsTab({ prescriptions, loading, isSaving, onAddPrescription, encounterId, patientId, doctorId, prescribedBy, isActive = false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ medication_name: '', dosage: '', route: '', frequency: '', duration: '', instructions: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.medication_name.trim()) return;
    const success = await onAddPrescription({
      encounter_id: encounterId, patient_id: patientId, doctor_id: doctorId, prescribed_by: prescribedBy,
      medication_name: form.medication_name.trim(), dosage: form.dosage.trim() || null,
      route: form.route.trim() || null, frequency: form.frequency.trim() || null,
      duration: form.duration.trim() || null, instructions: form.instructions.trim() || null,
      status: 'active',
    });
    if (success) { setForm({ medication_name: '', dosage: '', route: '', frequency: '', duration: '', instructions: '' }); setShowForm(false); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {isActive && !showForm && (
        <button onClick={() => setShowForm(true)} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>Add Prescription
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Prescription</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Medication *</label>
              <input type="text" value={form.medication_name} onChange={(e) => setForm({ ...form, medication_name: e.target.value })} placeholder="e.g. Amoxicillin 500mg" className={INPUT_CLASS} autoFocus />
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
            <button type="button" onClick={() => setShowForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
            <button type="submit" disabled={!form.medication_name.trim() || isSaving} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
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
