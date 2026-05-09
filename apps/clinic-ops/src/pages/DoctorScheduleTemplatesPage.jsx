import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { DataTable, Modal, FormField, LoadingSkeleton, StatusBadge } from '@ui/components/ui';
import { scheduleService } from '@core/services/schedules';
import { clinicService } from '@core/services/clinics';
import { stagger, fadeUp } from '@core/lib/animations';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_TEMPLATE = {
  weekday: 1,
  start_time: '09:00',
  end_time: '17:00',
  slot_duration_minutes: 30,
  is_active: true,
  effective_from: '',
  effective_to: '',
  clinic_id: '',
};

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function getSlotCount(startTime, endTime, duration) {
  if (!startTime || !endTime || !duration) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) return 0;
  return Math.floor((endMins - startMins) / duration);
}

export default function DoctorScheduleTemplatesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { displayName } = useBrand();

  const [templates, setTemplates] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_TEMPLATE });
  const [saving, setSaving] = useState(false);

  // Deactivate modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Materialize modal
  const [showMaterialize, setShowMaterialize] = useState(false);
  const [materializeDate, setMaterializeDate] = useState('');
  const [materializing, setMaterializing] = useState(false);

  // Filter
  const [showInactive, setShowInactive] = useState(false);
  const [dayFilter, setDayFilter] = useState('all');

  const doctorId = user?.doctor_id;

  const loadData = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);

    const [templatesResult, clinicsResult] = await Promise.all([
      scheduleService.getTemplatesByDoctor(doctorId, { activeOnly: !showInactive, pageSize: 200 }),
      clinicService.getAll({ pageSize: 100 }),
    ]);

    if (templatesResult.error) {
      setError(templatesResult.error);
      showToast(templatesResult.error, 'error');
    } else {
      setTemplates(templatesResult.data || []);
    }

    if (!clinicsResult.error && clinicsResult.data) {
      setClinics(clinicsResult.data);
    }

    setLoading(false);
  }, [doctorId, showInactive, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    if (dayFilter === 'all') return templates;
    return templates.filter((t) => String(t.weekday) === dayFilter);
  }, [templates, dayFilter]);

  // Grouped by weekday
  const groupedByDay = useMemo(() => {
    const groups = {};
    for (const t of filteredTemplates) {
      const day = WEEKDAYS[t.weekday] || `Day ${t.weekday}`;
      if (!groups[day]) groups[day] = [];
      groups[day].push(t);
    }
    // Sort by start_time within each day
    for (const day of Object.keys(groups)) {
      groups[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }
    return groups;
  }, [filteredTemplates]);

  const clinicMap = useMemo(() => {
    const map = {};
    for (const c of clinics) {
      map[c.id] = c;
    }
    return map;
  }, [clinics]);

  // Handlers
  const openCreate = () => {
    setModalMode('create');
    setEditingTemplate(null);
    setForm({
      ...DEFAULT_TEMPLATE,
      clinic_id: clinics[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEdit = (template) => {
    setModalMode('edit');
    setEditingTemplate(template);
    setForm({
      weekday: template.weekday,
      start_time: (template.start_time || '').slice(0, 5),
      end_time: (template.end_time || '').slice(0, 5),
      slot_duration_minutes: template.slot_duration_minutes || 30,
      is_active: template.is_active !== false,
      effective_from: template.effective_from || '',
      effective_to: template.effective_to || '',
      clinic_id: template.clinic_id || clinics[0]?.id || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      doctor_id: doctorId,
      clinic_id: form.clinic_id,
      weekday: Number(form.weekday),
      start_time: form.start_time,
      end_time: form.end_time,
      slot_duration_minutes: Number(form.slot_duration_minutes),
      is_active: form.is_active,
      effective_from: form.effective_from || null,
      effective_to: form.effective_to || null,
    };

    const result = modalMode === 'edit'
      ? await scheduleService.updateTemplate(editingTemplate.id, payload)
      : await scheduleService.createTemplate(payload);

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Schedule template ${modalMode === 'edit' ? 'updated' : 'created'} successfully.`, 'success');
      setShowModal(false);
      loadData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await scheduleService.deleteTemplate(deleteTarget.id);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Schedule template deactivated.', 'success');
      setDeleteTarget(null);
      loadData();
    }
    setDeleting(false);
  };

  const handleDeactivate = async (template) => {
    const result = await scheduleService.deactivateTemplate(template.id);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Template deactivated.', 'success');
      loadData();
    }
  };

  const handleMaterialize = async () => {
    if (!materializeDate) {
      showToast('Please select a target date.', 'error');
      return;
    }
    setMaterializing(true);
    const result = await scheduleService.materializeUpToDate(materializeDate, {
      doctorId,
      createdBy: user?.id,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      const count = result.data?.length || 0;
      showToast(`Generated ${count} appointment slot${count !== 1 ? 's' : ''}.`, 'success');
      setShowMaterialize(false);
      setMaterializeDate('');
    }
    setMaterializing(false);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const previewSlots = getSlotCount(form.start_time, form.end_time, Number(form.slot_duration_minutes));

  if (!doctorId) {
    return (
      <DashboardLayout role="doctor" pageTitle="Schedule Templates">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Doctor context not available. Please log in as a doctor.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor" pageTitle="Schedule Templates">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">

        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedule Templates</h1>
            <p className="text-sm text-slate-500 mt-1">
              Define your recurring weekly availability. Slots are generated from these templates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowMaterialize(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">auto_fix_high</span>
              Generate Slots
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              New Template
            </motion.button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Days</option>
            {WEEKDAYS.map((day, i) => (
              <option key={i} value={String(i)}>{day}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            Show inactive
          </label>
          <div className="ml-auto text-sm text-slate-500">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </div>
        </motion.div>

        {/* Loading/Error/Empty */}
        {loading && <LoadingSkeleton rows={4} />}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            <button onClick={loadData} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {/* Templates grid by day */}
        {!loading && !error && filteredTemplates.length === 0 && (
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">event_note</span>
            <h3 className="text-lg font-semibold text-slate-700">No schedule templates yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Create your first schedule template to define when you&apos;re available for appointments.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create First Template
            </button>
          </motion.div>
        )}

        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedByDay).map(([day, dayTemplates]) => (
              <motion.div key={day} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                    {day}
                  </h2>
                  <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                    {dayTemplates.length} block{dayTemplates.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {dayTemplates.map((template) => {
                    const clinic = clinicMap[template.clinic_id];
                    const slots = getSlotCount(template.start_time, template.end_time, template.slot_duration_minutes);
                    return (
                      <div key={template.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-base font-semibold text-slate-900">
                              {formatTime(template.start_time)} — {formatTime(template.end_time)}
                            </span>
                            {!template.is_active && (
                              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Inactive</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">timer</span>
                              {template.slot_duration_minutes}min slots
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">grid_view</span>
                              {slots} slot{slots !== 1 ? 's' : ''}
                            </span>
                            {clinic && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                {clinic.name}
                              </span>
                            )}
                            {template.effective_from && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">event</span>
                                From {template.effective_from}
                              </span>
                            )}
                            {template.effective_to && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">event_busy</span>
                                Until {template.effective_to}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(template)}
                            title="Edit"
                            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          {template.is_active && (
                            <button
                              onClick={() => handleDeactivate(template)}
                              title="Deactivate"
                              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg">pause_circle</span>
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(template)}
                            title="Deactivate"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">pause_circle</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={modalMode === 'edit' ? 'Edit Schedule Template' : 'New Schedule Template'}
          >
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Weekday *</label>
                  <select
                    value={form.weekday}
                    onChange={(e) => updateField('weekday', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {WEEKDAYS.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Clinic *</label>
                  <select
                    value={form.clinic_id}
                    onChange={(e) => updateField('clinic_id', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => updateField('start_time', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => updateField('end_time', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slot Duration</label>
                  <select
                    value={form.slot_duration_minutes}
                    onChange={(e) => updateField('slot_duration_minutes', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {[10, 15, 20, 30, 45, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {previewSlots > 0 && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex items-center gap-2 text-sm text-primary">
                  <span className="material-symbols-outlined text-lg">info</span>
                  This will generate <strong>{previewSlots}</strong> appointment slot{previewSlots !== 1 ? 's' : ''} per {WEEKDAYS[Number(form.weekday)] || 'day'}.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={form.effective_from}
                    onChange={(e) => updateField('effective_from', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Effective Until</label>
                  <input
                    type="date"
                    value={form.effective_to}
                    onChange={(e) => updateField('effective_to', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateField('is_active', e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                Active (available for slot generation)
              </label>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.clinic_id}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Deactivate Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Deactivate Schedule Template"
          >
            <div className="p-1 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to deactivate the <strong>{WEEKDAYS[deleteTarget.weekday]}</strong> template
                ({formatTime(deleteTarget.start_time)} — {formatTime(deleteTarget.end_time)})?
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                Future unbooked slots linked to this template will be made unavailable, not deleted.
                Templates with booked appointments should stay preserved for history.
              </p>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-all"
                >
                  {deleting ? 'Deactivating…' : 'Deactivate Template'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Materialize Slots Modal */}
      <AnimatePresence>
        {showMaterialize && (
          <Modal
            isOpen={showMaterialize}
            onClose={() => setShowMaterialize(false)}
            title="Generate Appointment Slots"
          >
            <div className="p-1 space-y-4">
              <p className="text-sm text-slate-600">
                This will create appointment slots from today until the target date, based on your active schedule templates.
                Existing slots will not be duplicated.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Generate slots until *</label>
                <input
                  type="date"
                  value={materializeDate}
                  onChange={(e) => setMaterializeDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowMaterialize(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMaterialize}
                  disabled={materializing || !materializeDate}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {materializing ? 'Generating…' : 'Generate Slots'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
