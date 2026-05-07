import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { slotService } from '@/services/slots';
import { clinicService } from '@/services/clinics';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputCls =
  'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300';

const btnPrimary =
  'flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm';

const btnDanger =
  'flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-all';

const btnSecondary =
  'flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

const BLANK_MANUAL = { clinic_id: '', date: '', start_time: '', end_time: '' };
const BLANK_RECURRING = {
  clinic_id: '', start_time: '', end_time: '', weekdays: [], occurrences: 4,
};

export default function SecretarySlotsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [mode, setMode] = useState('manual'); // 'manual' | 'recurring'
  const [clinics, setClinics] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [manualForm, setManualForm] = useState(BLANK_MANUAL);
  const [recurringForm, setRecurringForm] = useState(BLANK_RECURRING);

  const [editingSlot, setEditingSlot] = useState(null); // slot being edited
  const [editForm, setEditForm] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'single'|'group', id }

  const [filterDate, setFilterDate] = useState('');
  const [filterClinic, setFilterClinic] = useState('');

  // Load clinics and slots
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: c }, { data: s }] = await Promise.all([
        clinicService.getAll(),
        slotService.getAll(),
      ]);
      setClinics(c || []);
      setSlots(s || []);
      setLoading(false);
    }
    load();
  }, []);

  const refreshSlots = async () => {
    const { data } = await slotService.getAll();
    setSlots(data || []);
  };

  // Filtered slot list
  const filteredSlots = useMemo(() => {
    return slots.filter(s => {
      if (filterDate && s.date !== filterDate) return false;
      if (filterClinic && s.clinic_id !== filterClinic) return false;
      return true;
    });
  }, [slots, filterDate, filterClinic]);

  // ── Manual submit ──────────────────────────────────────────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.clinic_id || !manualForm.date || !manualForm.start_time || !manualForm.end_time) {
      showToast('Please fill all fields', 'error');
      return;
    }
    if (manualForm.start_time >= manualForm.end_time) {
      showToast('End time must be after start time', 'error');
      return;
    }
    if (!user?.doctor_id) {
      showToast('Doctor schedule is not linked to your account yet. Please sign in again or contact the clinic owner.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await slotService.createManualSlot({
      ...manualForm,
      doctor_id: user.doctor_id,
      created_by: user.id,
      is_active: true,
    });
    setSaving(false);
    if (error) { showToast('Failed to create slot: ' + error.message, 'error'); return; }
    showToast('Slot created successfully', 'success');
    setManualForm(BLANK_MANUAL);
    refreshSlots();
  };

  // ── Recurring submit ───────────────────────────────────────────────────────
  const handleRecurringSubmit = async (e) => {
    e.preventDefault();
    const { clinic_id, start_time, end_time, weekdays, occurrences } = recurringForm;
    if (!clinic_id || !start_time || !end_time || weekdays.length === 0 || !occurrences) {
      showToast('Please fill all fields and select at least one weekday', 'error');
      return;
    }
    if (start_time >= end_time) {
      showToast('End time must be after start time', 'error');
      return;
    }
    if (!user?.doctor_id) {
      showToast('Doctor schedule is not linked to your account yet. Please sign in again or contact the clinic owner.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await slotService.createRecurringSlots({
      doctor_id: user.doctor_id,
      clinic_id,
      start_time,
      end_time,
      weekdays: weekdays.map(Number),
      occurrences: Number(occurrences),
      created_by: user.id,
    });
    setSaving(false);
    if (error) { showToast('Failed to create recurring slots: ' + error.message, 'error'); return; }
    showToast(`${occurrences} recurring slots created`, 'success');
    setRecurringForm(BLANK_RECURRING);
    refreshSlots();
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (slot) => {
    setEditingSlot(slot);
    setEditForm({ clinic_id: slot.clinic_id, date: slot.date, start_time: slot.start_time, end_time: slot.end_time });
  };

  const handleEditSave = async () => {
    if (!editForm.date || !editForm.start_time || !editForm.end_time) {
      showToast('Please fill all fields', 'error');
      return;
    }
    const { error } = await slotService.editSlot(editingSlot.id, editForm);
    if (error) { showToast('Failed to update slot', 'error'); return; }
    showToast('Slot updated', 'success');
    setEditingSlot(null);
    refreshSlots();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    let error;
    if (deleteConfirm.type === 'single') {
      ({ error } = await slotService.deleteSlot(deleteConfirm.id));
    } else {
      ({ error } = await slotService.deleteGroup(deleteConfirm.id));
    }
    if (error) { showToast('Failed to delete', 'error'); return; }
    showToast('Deleted successfully', 'success');
    setDeleteConfirm(null);
    refreshSlots();
  };

  // ── Toggle weekday in recurring form ──────────────────────────────────────
  const toggleWeekday = (day) => {
    setRecurringForm(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day],
    }));
  };

  const cardAnim = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <DashboardLayout role="secretary">
      <div className="flex-1 p-8 ml-64 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Slot Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Create and manage appointment time slots for the doctor</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-8 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
          {['manual', 'recurring'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'manual' ? '📅 Manual Slot' : '🔄 Recurring Slots'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* ── Creation Form ────────────────────────────────────── */}
          <div className="xl:col-span-1">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
            >
              {mode === 'manual' ? (
                <>
                  <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                    <span className="text-blue-600">📅</span> Manual Slot
                  </h2>
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Clinic</label>
                      <select
                        className={inputCls}
                        value={manualForm.clinic_id}
                        onChange={e => setManualForm(p => ({ ...p, clinic_id: e.target.value }))}
                        required
                      >
                        <option value="">Select clinic…</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                      <input type="date" className={inputCls} value={manualForm.date}
                        onChange={e => setManualForm(p => ({ ...p, date: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
                        <input type="time" className={inputCls} value={manualForm.start_time}
                          onChange={e => setManualForm(p => ({ ...p, start_time: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time</label>
                        <input type="time" className={inputCls} value={manualForm.end_time}
                          onChange={e => setManualForm(p => ({ ...p, end_time: e.target.value }))} required />
                      </div>
                    </div>
                    <button type="submit" className={`${btnPrimary} w-full justify-center mt-2`} disabled={saving}>
                      {saving ? '⏳ Saving…' : '➕ Create Slot'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                    <span className="text-blue-600">🔄</span> Recurring Slots
                  </h2>
                  <form onSubmit={handleRecurringSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Clinic</label>
                      <select
                        className={inputCls}
                        value={recurringForm.clinic_id}
                        onChange={e => setRecurringForm(p => ({ ...p, clinic_id: e.target.value }))}
                        required
                      >
                        <option value="">Select clinic…</option>
                        {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
                        <input type="time" className={inputCls} value={recurringForm.start_time}
                          onChange={e => setRecurringForm(p => ({ ...p, start_time: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time</label>
                        <input type="time" className={inputCls} value={recurringForm.end_time}
                          onChange={e => setRecurringForm(p => ({ ...p, end_time: e.target.value }))} required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2">Weekdays</label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((label, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleWeekday(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              recurringForm.weekdays.includes(idx)
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Number of Occurrences</label>
                      <input
                        type="number" min="1" max="52" className={inputCls}
                        value={recurringForm.occurrences}
                        onChange={e => setRecurringForm(p => ({ ...p, occurrences: e.target.value }))}
                        required
                      />
                    </div>
                    <button type="submit" className={`${btnPrimary} w-full justify-center mt-2`} disabled={saving}>
                      {saving ? '⏳ Generating…' : `🗓️ Generate ${recurringForm.occurrences} Slots`}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>

          {/* ── Slot List ─────────────────────────────────────────── */}
          <div className="xl:col-span-2">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* List Header + Filters */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-3 justify-between">
                <h2 className="text-base font-black text-slate-900">All Slots</h2>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="date"
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    placeholder="Filter by date"
                  />
                  <select
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={filterClinic}
                    onChange={e => setFilterClinic(e.target.value)}
                  >
                    <option value="">All clinics</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {(filterDate || filterClinic) && (
                    <button
                      onClick={() => { setFilterDate(''); setFilterClinic(''); }}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mr-3"></div>
                  Loading slots…
                </div>
              ) : filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <span className="text-4xl">📭</span>
                  <p className="text-sm font-medium">No slots found</p>
                  <p className="text-xs">Create your first slot using the form</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {filteredSlots.map(slot => (
                      <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${slot.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{formatDate(slot.date)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            🕐 {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            {slot.clinics && <span className="ml-2 text-blue-600">📍 {slot.clinics.name}</span>}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          slot.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {slot.is_active ? 'Available' : 'Booked'}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button className={btnSecondary} onClick={() => openEdit(slot)}>✏️ Edit</button>
                          <button className={btnDanger} onClick={() => setDeleteConfirm({ type: 'single', id: slot.id })}>
                            🗑️ Delete
                          </button>
                          {slot.recurrence_group_id && (
                            <button
                              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-semibold rounded-lg transition-all"
                              onClick={() => setDeleteConfirm({ type: 'group', id: slot.recurrence_group_id })}
                            >
                              🔄 Del Group
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Edit Modal ────────────────────────────────────────────── */}
        <AnimatePresence>
          {editingSlot && (
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingSlot(null)}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-black text-slate-900 mb-5">✏️ Edit Slot</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Clinic</label>
                    <select className={inputCls} value={editForm.clinic_id}
                      onChange={e => setEditForm(p => ({ ...p, clinic_id: e.target.value }))}>
                      <option value="">Select clinic…</option>
                      {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                    <input type="date" className={inputCls} value={editForm.date}
                      onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
                      <input type="time" className={inputCls} value={editForm.start_time}
                        onChange={e => setEditForm(p => ({ ...p, start_time: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time</label>
                      <input type="time" className={inputCls} value={editForm.end_time}
                        onChange={e => setEditForm(p => ({ ...p, end_time: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button className={`${btnPrimary} flex-1 justify-center`} onClick={handleEditSave}>Save Changes</button>
                  <button className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                    onClick={() => setEditingSlot(null)}>Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete Confirm Modal ──────────────────────────────────── */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🗑️</div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Confirm Deletion</h3>
                <p className="text-sm text-slate-500 mb-6">
                  {deleteConfirm.type === 'group'
                    ? 'This will delete all slots in the recurring group. This action cannot be undone.'
                    : 'This will permanently delete this slot. This action cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all"
                    onClick={confirmDelete}
                  >
                    {deleteConfirm.type === 'group' ? 'Delete Group' : 'Delete Slot'}
                  </button>
                  <button
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
