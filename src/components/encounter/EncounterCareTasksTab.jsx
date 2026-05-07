import { useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'call_patient', label: 'Call Patient' },
  { value: 'review_result', label: 'Review Result' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-500' },
  { value: 'normal', label: 'Normal', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-amber-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
];

export default function EncounterCareTasksTab({ tasks, loading, isSaving, onCreateTask, onUpdateTask, encounterId, patientId, createdBy, isActive = false }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', task_type: 'follow_up', priority: 'normal', description: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const success = await onCreateTask({
      encounter_id: encounterId, patient_id: patientId, created_by: createdBy,
      title: form.title.trim(), task_type: form.task_type, priority: form.priority,
      description: form.description.trim() || null, status: 'open',
    });
    if (success) { setForm({ title: '', task_type: 'follow_up', priority: 'normal', description: '' }); setShowForm(false); }
  };

  const toggleDone = async (task) => {
    if (task.status === 'done') return;
    await onUpdateTask(task.id, { status: 'done', completed_at: new Date().toISOString() });
  };

  if (loading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      {isActive && !showForm && (
        <button onClick={() => setShowForm(true)} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>New Task
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Care Task</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Follow up in 2 weeks" className={INPUT_CLASS} autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
              <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })} className={INPUT_CLASS}>
                {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={INPUT_CLASS}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details..." rows={2} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
            <button type="submit" disabled={!form.title.trim() || isSaving} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
              {isSaving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}Save
            </button>
          </div>
        </form>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon="task_alt" title="No care tasks" subtitle="Create tasks for follow-ups, calls, or reviews." />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className={`rounded-xl border bg-white p-4 flex items-start gap-3 ${task.status === 'done' ? 'border-emerald-200 opacity-70' : 'border-slate-200'}`}>
              <button onClick={() => toggleDone(task)} disabled={isSaving || task.status === 'done'} className="mt-0.5 shrink-0">
                <span className={`material-symbols-outlined text-xl ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300 hover:text-primary'}`}>
                  {task.status === 'done' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</h4>
                  <StatusBadge status={task.status} size="sm" />
                  <span className={`text-[10px] font-bold uppercase ${PRIORITIES.find((p) => p.value === task.priority)?.color || ''}`}>{task.priority}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-400 mt-1">
                  <span className="capitalize">{task.task_type?.replace(/_/g, ' ')}</span>
                </div>
                {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
