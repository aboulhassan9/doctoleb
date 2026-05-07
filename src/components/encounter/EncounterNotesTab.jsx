import { useState } from 'react';
import { LoadingSkeleton, EmptyState } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

const NOTE_TYPES = [
  { value: 'subjective', label: 'Subjective', icon: 'person' },
  { value: 'objective', label: 'Objective', icon: 'monitor_heart' },
  { value: 'assessment', label: 'Assessment', icon: 'fact_check' },
  { value: 'plan', label: 'Plan', icon: 'assignment' },
  { value: 'general', label: 'General', icon: 'description' },
  { value: 'private', label: 'Private', icon: 'lock' },
];

const NOTE_TYPE_COLORS = {
  subjective: 'bg-blue-50 text-blue-700 border-blue-200',
  objective: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assessment: 'bg-purple-50 text-purple-700 border-purple-200',
  plan: 'bg-amber-50 text-amber-700 border-amber-200',
  general: 'bg-slate-50 text-slate-700 border-slate-200',
  private: 'bg-red-50 text-red-700 border-red-200',
};

/**
 * EncounterNotesTab — Visit notes list + add form.
 *
 * @param {{ notes: Array, loading: boolean, isSaving: boolean, onAddNote: (payload: object) => Promise<boolean>, encounterId: string, patientId: string, doctorId: string, authorUserId: string, isActive: boolean }} props
 */
export default function EncounterNotesTab({
  notes,
  loading,
  isSaving,
  onAddNote,
  encounterId,
  patientId,
  doctorId,
  authorUserId,
  isActive = false,
}) {
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState('general');
  const [content, setContent] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    const success = await onAddNote({
      encounter_id: encounterId,
      patient_id: patientId,
      doctor_id: doctorId,
      author_user_id: authorUserId,
      note_type: noteType,
      content: content.trim(),
    });

    if (success) {
      setContent('');
      setNoteType('general');
      setShowForm(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      {/* Add Note Button / Form */}
      {isActive && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className={`${BUTTON_PRIMARY} flex items-center gap-2`}
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Note
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">New Clinical Note</h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              {/* Note Type Selector */}
              <div className="flex flex-wrap gap-2">
                {NOTE_TYPES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNoteType(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      noteType === value
                        ? NOTE_TYPE_COLORS[value]
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your clinical note..."
                rows={4}
                className={TEXTAREA_CLASS}
                autoFocus
              />

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={BUTTON_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || isSaving}
                  className={`${BUTTON_PRIMARY} flex items-center gap-2`}
                >
                  {isSaving && (
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  )}
                  Save Note
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <EmptyState
          icon="edit_note"
          title="No clinical notes yet"
          subtitle={isActive ? 'Start documenting the encounter by adding a note.' : 'No notes were recorded during this encounter.'}
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-4 ${NOTE_TYPE_COLORS[note.note_type] || NOTE_TYPE_COLORS.general}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {note.note_type?.replace(/_/g, ' ') || 'General'}
                  </span>
                  {note.visibility === 'doctor_private' && (
                    <span className="material-symbols-outlined text-sm opacity-60">lock</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatTime(note.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
              {note.users && (
                <p className="text-[10px] text-slate-400 mt-2">
                  — {note.users.first_name} {note.users.last_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(dateString) {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}
