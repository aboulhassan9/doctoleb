import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@ui/contexts/ToastContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { Modal, LoadingSkeleton } from '@ui/components/ui';
import { insuranceService } from '@core/services/insurance';
import { patientService } from '@core/services/patients';
import { stagger, fadeUp } from '@core/lib/animations';

const POLICY_STATUSES = {
  active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700' },
  expired: { label: 'Expired', color: 'bg-red-50 text-red-500' },
  suspended: { label: 'Suspended', color: 'bg-amber-50 text-amber-600' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500' },
};

export default function SecretaryPatientInsurancePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [patient, setPatient] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    provider_id: '', policy_number: '', group_number: '',
    is_primary: false, coverage_start: '', coverage_end: '', status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [patResult, polResult, provResult] = await Promise.all([
      patientService.getById(patientId),
      insuranceService.getPatientPolicies(patientId, { pageSize: 100 }),
      insuranceService.getProviders({ pageSize: 200 }),
    ]);
    if (patResult.data) setPatient(patResult.data);
    if (polResult.data) setPolicies(polResult.data);
    if (provResult.data) setProviders(provResult.data);
    if (patResult.error) {
      showToast(patResult.error, 'error');
      navigate(-1);
    }
    setLoading(false);
  }, [patientId, showToast, navigate]);

  useEffect(() => { load(); }, [load]);

  const providerMap = {};
  for (const p of providers) providerMap[p.id] = p;

  const openCreate = () => {
    setModalMode('create');
    setEditing(null);
    setForm({
      provider_id: providers[0]?.id || '', policy_number: '', group_number: '',
      is_primary: policies.length === 0, coverage_start: '', coverage_end: '', status: 'active',
    });
    setShowModal(true);
  };

  const openEdit = (policy) => {
    setModalMode('edit');
    setEditing(policy);
    setForm({
      provider_id: policy.provider_id || '',
      policy_number: policy.policy_number || '',
      group_number: policy.group_number || '',
      is_primary: policy.is_primary || false,
      coverage_start: policy.coverage_start || '',
      coverage_end: policy.coverage_end || '',
      status: policy.status || 'active',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      patient_id: patientId,
      provider_id: form.provider_id,
      policy_number: form.policy_number || null,
      group_number: form.group_number || null,
      is_primary: form.is_primary,
      coverage_start: form.coverage_start || null,
      coverage_end: form.coverage_end || null,
      status: form.status,
    };
    const result = modalMode === 'edit'
      ? await insuranceService.updatePatientPolicy(editing.id, payload)
      : await insuranceService.savePatientPolicy(payload);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Policy ${modalMode === 'edit' ? 'updated' : 'added'}.`, 'success');
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const patientName = patient
    ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'
    : '...';

  return (
    <DashboardLayout role="secretary" pageTitle={`Insurance — ${patientName}`}>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">

        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button onClick={() => navigate(-1)}
              className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-2 transition-colors">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Insurance Policies</h1>
            <p className="text-sm text-slate-500 mt-1">
              Managing insurance for <strong>{patientName}</strong>
            </p>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">add</span>
            Add Policy
          </motion.button>
        </motion.div>

        {loading && <LoadingSkeleton rows={3} />}

        {!loading && policies.length === 0 && (
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4 block">shield</span>
            <h3 className="text-lg font-semibold text-slate-700">No insurance policies</h3>
            <p className="text-sm text-slate-500 mt-2">Add this patient&apos;s first insurance policy.</p>
            <button onClick={openCreate}
              className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">add</span>
              Add First Policy
            </button>
          </motion.div>
        )}

        {!loading && policies.length > 0 && (
          <div className="space-y-3">
            {policies.map((policy) => {
              const provider = providerMap[policy.provider_id];
              const statusDisplay = POLICY_STATUSES[policy.status] || POLICY_STATUSES.active;
              return (
                <motion.div key={policy.id} variants={fadeUp}
                  className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-all ${
                    policy.is_primary ? 'border-primary/30 ring-1 ring-primary/10' : 'border-slate-200'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{provider?.name || 'Unknown Provider'}</h3>
                        {policy.is_primary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">Primary</span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusDisplay.color}`}>
                          {statusDisplay.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                        {policy.policy_number && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">tag</span>
                            Policy: <strong className="font-mono">{policy.policy_number}</strong>
                          </span>
                        )}
                        {policy.group_number && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">group</span>
                            Group: {policy.group_number}
                          </span>
                        )}
                        {policy.coverage_start && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">event</span>
                            From {policy.coverage_start}
                          </span>
                        )}
                        {policy.coverage_end && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">event_busy</span>
                            Until {policy.coverage_end}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => openEdit(policy)}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal isOpen={showModal} onClose={() => setShowModal(false)}
            title={`${modalMode === 'edit' ? 'Edit' : 'Add'} Insurance Policy`}>
            <div className="space-y-4 p-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Insurance Provider *</label>
                <select value={form.provider_id}
                  onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Policy Number</label>
                  <input type="text" value={form.policy_number}
                    onChange={(e) => setForm((f) => ({ ...f, policy_number: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Group Number</label>
                  <input type="text" value={form.group_number}
                    onChange={(e) => setForm((f) => ({ ...f, group_number: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Coverage Start</label>
                  <input type="date" value={form.coverage_start}
                    onChange={(e) => setForm((f) => ({ ...f, coverage_start: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Coverage End</label>
                  <input type="date" value={form.coverage_end}
                    onChange={(e) => setForm((f) => ({ ...f, coverage_end: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pb-2.5">
                    <input type="checkbox" checked={form.is_primary}
                      onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                      className="rounded border-slate-300 text-primary focus:ring-primary/30"
                    />
                    Primary policy
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.provider_id}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                  {saving ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Add Policy'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
