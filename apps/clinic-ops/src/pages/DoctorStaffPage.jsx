import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { Modal, LoadingSkeleton } from '@ui/components/ui';
import { staffService } from '@core/services/staff';
import { stagger, fadeUp } from '@core/lib/animations';
import { createClientRequestId } from '@core/lib/idempotency';
import { DEFAULT_STAFF_MEMBER_ROLE, SUPPORTED_STAFF_MEMBER_ROLES } from '@core/lib/roles';

const STAFF_ROLE_PRESENTATION = {
  secretary: { label: 'Secretary', icon: 'badge', color: 'text-indigo-600 bg-indigo-50' },
  predoctor: { label: 'Pre-Doctor', icon: 'stethoscope', color: 'text-teal-600 bg-teal-50' },
};

const UNSUPPORTED_ROLE_DISPLAY = {
  label: 'Unsupported Role',
  icon: 'block',
  color: 'text-slate-600 bg-slate-100',
};

const STAFF_ROLES = SUPPORTED_STAFF_MEMBER_ROLES.map((value) => ({
  value,
  ...STAFF_ROLE_PRESENTATION[value],
}));

const INVITE_STATUSES = {
  none: { label: 'Not Invited', color: 'bg-slate-100 text-slate-600' },
  invited: { label: 'Invited', color: 'bg-blue-50 text-blue-600' },
  accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-600' },
  disabled: { label: 'Disabled', color: 'bg-red-50 text-red-500' },
};

const DEFAULT_FORM = {
  display_name: '',
  role: DEFAULT_STAFF_MEMBER_ROLE,
  phone: '',
  email: '',
  hire_date: '',
};

function buildStaffUpdatePayload(form) {
  return {
    display_name: form.display_name,
    phone: form.phone || null,
    hire_date: form.hire_date || null,
  };
}

function getDisableCopy(member) {
  const isPendingInvite = member?.invite_status !== 'accepted';

  return {
    title: isPendingInvite ? 'Cancel Staff Invite' : 'Disable Staff Access',
    message: isPendingInvite
      ? 'This cancels the pending invite, disables the roster entry, and prevents the invite from being used.'
      : 'This disables the roster entry and blocks this staff member from using the app.',
    actionLabel: isPendingInvite ? 'Cancel invite' : 'Disable access',
    pendingLabel: isPendingInvite ? 'Cancelling...' : 'Disabling...',
    successMessage: isPendingInvite ? 'Staff invite cancelled.' : 'Staff access disabled.',
  };
}

function canResendInvite(member) {
  return member?.is_active === true && member?.invite_status === 'invited';
}

function canReactivateStaff(member) {
  return (
    member?.is_active === false
    && member?.invite_status === 'disabled'
    && member?.disabled_previous_invite_status === 'accepted'
  );
}

function canReissueInvite(member) {
  return (
    member?.is_active === false
    && member?.invite_status === 'disabled'
    && ['none', 'invited'].includes(member?.disabled_previous_invite_status)
    && Boolean(member?.email)
  );
}

function getRoleDisplay(role) {
  return STAFF_ROLES.find((r) => r.value === role) || UNSUPPORTED_ROLE_DISPLAY;
}

export default function DoctorStaffPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const doctorId = user?.doctor_id;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState(null);
  const [reissuingInviteId, setReissuingInviteId] = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);

  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');

  const loadStaff = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);

    const result = await staffService.getByDoctorId(doctorId, {
      activeOnly: !showInactive,
      pageSize: 200,
    });

    if (result.error) {
      setError(result.error);
      showToast(result.error, 'error');
    } else {
      setStaff(result.data || []);
    }
    setLoading(false);
  }, [doctorId, showInactive, showToast]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filtered = roleFilter === 'all'
    ? staff
    : staff.filter((m) => m.role === roleFilter);

  const openCreate = () => {
    setModalMode('create');
    setEditingMember(null);
    setForm({ ...DEFAULT_FORM });
    setShowModal(true);
  };

  const openEdit = (member) => {
    setModalMode('edit');
    setEditingMember(member);
    setForm({
      display_name: member.display_name || '',
      role: member.role || DEFAULT_STAFF_MEMBER_ROLE,
      phone: member.phone || '',
      email: member.email || '',
      hire_date: member.hire_date || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = modalMode === 'edit'
      ? await staffService.update(editingMember.id, buildStaffUpdatePayload(form))
      : await staffService.invite({
        display_name: form.display_name,
        role: form.role,
        phone: form.phone || null,
        email: form.email || '',
        hire_date: form.hire_date || null,
        client_request_id: createClientRequestId(),
      });

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Staff member ${modalMode === 'edit' ? 'updated' : 'invited'} successfully.`, 'success');
      setShowModal(false);
      loadStaff();
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const copy = getDisableCopy(deactivateTarget);
    setDeactivating(true);
    const result = await staffService.deactivate(deactivateTarget.id);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(copy.successMessage, 'success');
      setDeactivateTarget(null);
      loadStaff();
    }
    setDeactivating(false);
  };

  const handleResendInvite = async (member) => {
    if (!canResendInvite(member)) {
      showToast('Only active pending invites can be resent.', 'error');
      return;
    }

    const clientRequestId = createClientRequestId();
    if (!clientRequestId) {
      showToast('Your browser could not create a safe request id. Refresh and try again.', 'error');
      return;
    }

    setResendingInviteId(member.id);
    const result = await staffService.resendInvite(member.id, clientRequestId);

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Staff invite resent.', 'success');
      loadStaff();
    }

    setResendingInviteId(null);
  };

  const handleReactivate = async (member) => {
    if (!canReactivateStaff(member)) {
      showToast('Only previously accepted disabled staff can be reactivated.', 'error');
      return;
    }

    setReactivatingId(member.id);
    const result = await staffService.reactivate(member.id);

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Staff access reactivated.', 'success');
      loadStaff();
    }

    setReactivatingId(null);
  };

  const handleReissueInvite = async (member) => {
    if (!canReissueInvite(member)) {
      showToast('Only cancelled pending invites can be reissued.', 'error');
      return;
    }

    const clientRequestId = createClientRequestId();
    if (!clientRequestId) {
      showToast('Your browser could not create a safe request id. Refresh and try again.', 'error');
      return;
    }

    setReissuingInviteId(member.id);
    const result = await staffService.reissueInvite(member.id, clientRequestId);

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Staff invite reissued.', 'success');
      loadStaff();
    }

    setReissuingInviteId(null);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Summary stats
  const stats = STAFF_ROLES.map((r) => ({
    ...r,
    count: staff.filter((m) => m.role === r.value).length,
  }));

  if (!doctorId) {
    return (
      <DashboardLayout role="doctor" pageTitle="Staff">
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Doctor context not available.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor" pageTitle="Staff">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">

        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff Roster</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your team members and their roles.</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Add Staff Member
          </motion.button>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((s) => (
            <button
              key={s.value}
              onClick={() => setRoleFilter(roleFilter === s.value ? 'all' : s.value)}
              className={`p-3 rounded-xl border transition-all text-left ${
                roleFilter === s.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`material-symbols-outlined text-lg ${s.color.split(' ')[0]}`}>{s.icon}</span>
                <span className="text-xs font-medium text-slate-500 truncate">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{s.count}</p>
            </button>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            Show inactive
          </label>
          <span className="ml-auto text-sm text-slate-500">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
        </motion.div>

        {/* Content */}
        {loading && <LoadingSkeleton rows={4} />}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            <button onClick={loadStaff} className="ml-3 underline font-medium">Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">group</span>
            <h3 className="text-lg font-semibold text-slate-700">No staff members yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Add supported v1 team members: secretaries and pre-doctors.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              Add First Member
            </button>
          </motion.div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((member) => {
              const roleDisplay = getRoleDisplay(member.role);
              const inviteStatus = INVITE_STATUSES[member.invite_status] || INVITE_STATUSES.none;
              const initials = (member.display_name || '')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || '??';

              return (
                <motion.div
                  key={member.id}
                  whileHover={{ y: -2 }}
                  className={`bg-white rounded-2xl border border-slate-200 p-5 transition-shadow hover:shadow-md ${
                    !member.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${roleDisplay.color}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{member.display_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleDisplay.color}`}>
                          {roleDisplay.label}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inviteStatus.color}`}>
                          {inviteStatus.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canReactivateStaff(member) && (
                        <button
                          onClick={() => handleReactivate(member)}
                          disabled={reactivatingId === member.id}
                          title="Reactivate access"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="sr-only">Reactivate access</span>
                          <span className="material-symbols-outlined text-lg">
                            {reactivatingId === member.id ? 'hourglass_top' : 'person_check'}
                          </span>
                        </button>
                      )}
                      {canReissueInvite(member) && (
                        <button
                          onClick={() => handleReissueInvite(member)}
                          disabled={reissuingInviteId === member.id}
                          title="Reissue cancelled invite"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="sr-only">Reissue cancelled invite</span>
                          <span className="material-symbols-outlined text-lg">
                            {reissuingInviteId === member.id ? 'hourglass_top' : 'person_add'}
                          </span>
                        </button>
                      )}
                      {canResendInvite(member) && (
                        <button
                          onClick={() => handleResendInvite(member)}
                          disabled={resendingInviteId === member.id}
                          title="Resend invite"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="sr-only">Resend invite</span>
                          <span className="material-symbols-outlined text-lg">
                            {resendingInviteId === member.id ? 'hourglass_top' : 'forward_to_inbox'}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(member)}
                        title="Edit staff member"
                        aria-label="Edit staff member"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      {member.is_active && (
                        <button
                          onClick={() => setDeactivateTarget(member)}
                          title={member.invite_status === 'accepted' ? 'Disable staff access' : 'Cancel staff invite'}
                          aria-label={member.invite_status === 'accepted' ? 'Disable staff access' : 'Cancel staff invite'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">person_off</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    {member.email && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                        <span className="material-symbols-outlined text-sm">mail</span>
                        {member.email}
                      </p>
                    )}
                    {member.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">phone</span>
                        {member.phone}
                      </p>
                    )}
                    {member.hire_date && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">event</span>
                        Hired {member.hire_date}
                      </p>
                    )}
                    {member.invite_resend_count > 0 && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">mark_email_read</span>
                        Invite resent {member.invite_resend_count} time{member.invite_resend_count === 1 ? '' : 's'}
                      </p>
                    )}
                    {member.reactivation_count > 0 && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">person_check</span>
                        Reactivated {member.reactivation_count} time{member.reactivation_count === 1 ? '' : 's'}
                      </p>
                    )}
                    {member.invite_reissue_count > 0 && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">person_add</span>
                        Invite reissued {member.invite_reissue_count} time{member.invite_reissue_count === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title={modalMode === 'edit' ? 'Edit Staff Member' : 'Add Staff Member'}
          >
            <div className="space-y-4 p-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => updateField('display_name', e.target.value)}
                  placeholder="e.g. Sarah Johnson"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modalMode === 'create' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                    <select
                      value={form.role}
                      onChange={(e) => updateField('role', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date</label>
                  <input
                    type="date"
                    value={form.hire_date}
                    onChange={(e) => updateField('hire_date', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+961 70 123 456"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.display_name.trim()}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Send Invite'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Deactivate Confirmation */}
      <AnimatePresence>
        {deactivateTarget && (
          <Modal
            isOpen={!!deactivateTarget}
            onClose={() => setDeactivateTarget(null)}
            title={getDisableCopy(deactivateTarget).title}
          >
            <div className="p-1 space-y-4">
              <p className="text-sm text-slate-600">
                {getDisableCopy(deactivateTarget).message}{' '}
                <strong>{deactivateTarget.display_name}</strong> will no longer have access.
              </p>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setDeactivateTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-all"
                >
                  {deactivating ? getDisableCopy(deactivateTarget).pendingLabel : getDisableCopy(deactivateTarget).actionLabel}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
