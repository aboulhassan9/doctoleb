import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { Modal, LoadingSkeleton, EmptyState } from '@ui/components/ui';
import { insuranceService } from '@core/services/insurance';
import { stagger, fadeUp } from '@core/lib/animations';

export default function SecretaryInsuranceProvidersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const doctorId = user?.doctor_id;

  const [providers, setProviders] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  // Contract modal
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [contractForm, setContractForm] = useState({
    doctor_provider_code: '',
    contract_start: '',
    contract_end: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [provResult, contResult] = await Promise.all([
      insuranceService.getProviders({ activeOnly: !showInactive, pageSize: 200 }),
      doctorId ? insuranceService.getDoctorContracts(doctorId, { activeOnly: false, pageSize: 200 }) : { data: [] },
    ]);
    if (provResult.data) setProviders(provResult.data);
    if (contResult.data) setContracts(contResult.data);
    if (provResult.error) showToast(provResult.error, 'error');
    setLoading(false);
  }, [doctorId, showInactive, showToast]);

  useEffect(() => { load(); }, [load]);

  const contractMap = {};
  for (const c of contracts) {
    contractMap[c.provider_id] = c;
  }

  const filtered = search
    ? providers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    : providers;

  const openContract = (provider) => {
    setSelectedProvider(provider);
    const existing = contractMap[provider.id];
    setContractForm({
      doctor_provider_code: existing?.doctor_provider_code || '',
      contract_start: existing?.contract_start || '',
      contract_end: existing?.contract_end || '',
      notes: existing?.notes || '',
    });
    setShowContractModal(true);
  };

  const handleSaveContract = async () => {
    setSaving(true);
    const result = await insuranceService.saveDoctorContract({
      doctor_id: doctorId,
      provider_id: selectedProvider.id,
      doctor_provider_code: contractForm.doctor_provider_code || null,
      contract_start: contractForm.contract_start || null,
      contract_end: contractForm.contract_end || null,
      notes: contractForm.notes || null,
      is_active: true,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`Contract with ${selectedProvider.name} saved.`, 'success');
      setShowContractModal(false);
      load();
    }
    setSaving(false);
  };

  const handleRemoveContract = async (providerId) => {
    const contract = contractMap[providerId];
    if (!contract) return;
    const result = await insuranceService.saveDoctorContract({
      ...contract,
      is_active: false,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Contract deactivated.', 'success');
      load();
    }
  };

  return (
    <DashboardLayout role="secretary" pageTitle="Insurance Providers">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">

        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-slate-900">Insurance Providers</h1>
          <p className="text-sm text-slate-500 mt-1">
            View available insurance providers and manage the doctor&apos;s contracts with each.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search providers…"
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/30" />
            Show inactive
          </label>
          <span className="ml-auto text-sm text-slate-500">{filtered.length} provider{filtered.length !== 1 ? 's' : ''}</span>
        </motion.div>

        {loading && <LoadingSkeleton rows={5} />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon="verified_user"
            title="No insurance providers found"
            subtitle="Add insurance providers from the Operations Catalogs page."
          />
        )}

        {!loading && filtered.length > 0 && (
          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((provider) => {
              const contract = contractMap[provider.id];
              const hasContract = contract && contract.is_active;
              return (
                <motion.div key={provider.id} whileHover={{ y: -2 }}
                  className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
                    hasContract ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                      {provider.code && <p className="text-xs text-slate-400 font-mono mt-0.5">{provider.code}</p>}
                    </div>
                    {hasContract ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        Contracted
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        No Contract
                      </span>
                    )}
                  </div>
                  {provider.description && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{provider.description}</p>
                  )}
                  {hasContract && contract.doctor_provider_code && (
                    <div className="bg-white rounded-lg p-2 border border-slate-100 mb-3">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Provider Code</span>
                      <p className="text-sm font-mono font-medium text-slate-700">{contract.doctor_provider_code}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={() => openContract(provider)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary/5 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">{hasContract ? 'edit' : 'add'}</span>
                      {hasContract ? 'Edit Contract' : 'Add Contract'}
                    </button>
                    {hasContract && (
                      <button onClick={() => handleRemoveContract(provider.id)}
                        className="px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>

      {/* Contract Modal */}
      <AnimatePresence>
        {showContractModal && selectedProvider && (
          <Modal isOpen={showContractModal} onClose={() => setShowContractModal(false)}
            title={`Contract — ${selectedProvider.name}`}>
            <div className="space-y-4 p-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Provider Code</label>
                <input type="text" value={contractForm.doctor_provider_code}
                  onChange={(e) => setContractForm((f) => ({ ...f, doctor_provider_code: e.target.value }))}
                  placeholder="e.g. DR-12345"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={contractForm.contract_start}
                    onChange={(e) => setContractForm((f) => ({ ...f, contract_start: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={contractForm.contract_end}
                    onChange={(e) => setContractForm((f) => ({ ...f, contract_end: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={contractForm.notes}
                  onChange={(e) => setContractForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setShowContractModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveContract} disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                  {saving ? 'Saving…' : 'Save Contract'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
