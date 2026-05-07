import { useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

const DOC_TYPES = [
  { value: 'report', label: 'Report' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'referral', label: 'Referral' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'lab_request', label: 'Lab Request' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'imaging_result', label: 'Imaging Result' },
  { value: 'insurance_form', label: 'Insurance Form' },
  { value: 'other', label: 'Other' },
];

export default function EncounterDocumentsTab({
  documents = [],
  loading,
  isSaving,
  onCreateDocument,
  onFinalizeDocument,
  encounterId,
  patientId,
  doctorId,
  createdBy,
  isActive = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', document_type: 'report', content: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const success = await onCreateDocument({
      encounter_id: encounterId,
      patient_id: patientId,
      doctor_id: doctorId,
      created_by: createdBy,
      title: form.title.trim(),
      document_type: form.document_type,
      content: form.content.trim() || null,
      status: 'draft',
    });

    if (success) {
      setForm({ title: '', document_type: 'report', content: '' });
      setShowForm(false);
    }
  };

  const handleFinalize = async (docId) => {
    await onFinalizeDocument(docId);
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {isActive && !showForm && (
        <button onClick={() => setShowForm(true)} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>New Document
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Clinical Document</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Document title" className={INPUT_CLASS} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
              <select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })} className={INPUT_CLASS}>
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Content</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Document content..." rows={4} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
            <button type="submit" disabled={!form.title.trim() || isSaving} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
              {isSaving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}Create Draft
            </button>
          </div>
        </form>
      )}
      {documents.length === 0 ? (
        <EmptyState icon="description" title="No documents" subtitle="Create clinical documents for this encounter." />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">description</span>
                  <h4 className="text-sm font-bold text-slate-900">{doc.title}</h4>
                  <StatusBadge status={doc.status} size="sm" />
                </div>
                {doc.status === 'draft' && isActive && (
                  <button onClick={() => handleFinalize(doc.id)} disabled={isSaving} className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>Finalize
                  </button>
                )}
              </div>
              <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
                <span className="capitalize">{doc.document_type?.replace(/_/g, ' ')}</span>
                {doc.finalized_at && <span>• Finalized {new Date(doc.finalized_at).toLocaleDateString()}</span>}
              </div>
              {doc.content && <p className="text-xs text-slate-500 mt-2 line-clamp-3">{doc.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
