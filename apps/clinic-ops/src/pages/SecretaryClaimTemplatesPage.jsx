import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { insuranceService } from '@core/services/insurance';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import { PageHeader, EmptyState, Modal } from '@ui/components/ui';

/**
 * SecretaryClaimTemplatesPage — CRUD for claim_form_templates.
 * Per-provider templates override the generic fallback (provider_id IS NULL, is_system = true).
 * Secretary/admin role. Tier 1 §1.7.
 */
export default function SecretaryClaimTemplatesPage() {
  const { showToast } = useToast();
  const brand = useBrand();

  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', provider_id: '', template_body: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const [tplRes, provRes] = await Promise.all([
      insuranceService.getClaimTemplates({ activeOnly: false }),
      insuranceService.getProviders({ activeOnly: true }),
    ]);
    if (tplRes.data) setTemplates(tplRes.data);
    if (provRes.data) setProviders(provRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', provider_id: '', template_body: defaultTemplate(brand.displayName), is_active: true });
    setShowModal(true);
  };

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({
      name: tpl.name || '',
      provider_id: tpl.provider_id || '',
      template_body: tpl.template_body || '',
      is_active: tpl.is_active ?? true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      provider_id: form.provider_id || null,
      template_body: form.template_body,
      is_active: form.is_active,
    };

    const result = editing
      ? await insuranceService.updateClaimTemplate(editing.id, payload)
      : await insuranceService.saveClaimTemplate(payload);

    if (result.error) {
      showToast(result.error || 'Failed to save template', 'error');
    } else {
      showToast(editing ? 'Template updated' : 'Template created', 'success');
      setShowModal(false);
      load();
    }
  };

  const providerName = (id) => providers.find(p => p.id === id)?.name || 'Generic (all providers)';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Claim Form Templates"
        subtitle="Manage printable claim form templates. Per-provider templates override the generic fallback."
        actions={
          <button
            onClick={openAdd}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Template
          </button>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading templates…</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="description"
          title="No claim templates found"
          subtitle="Create one to get started."
        />
      ) : (
        <div className="grid gap-4">
          {templates.map((tpl) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white border rounded-xl p-5 hover:shadow-md transition cursor-pointer ${!tpl.is_active ? 'opacity-60' : ''}`}
              onClick={() => !tpl.is_system && openEdit(tpl)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{tpl.name}</h3>
                    {tpl.is_system && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">System</span>
                    )}
                    {!tpl.is_active && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Provider: {tpl.provider_id ? providerName(tpl.provider_id) : 'Generic (all providers)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {tpl.is_system ? (
                    <span className="material-symbols-outlined text-slate-300" title="System template — read only">lock</span>
                  ) : (
                    <span className="material-symbols-outlined text-slate-400">edit</span>
                  )}
                </div>
              </div>
              {tpl.template_body && (
                <pre className="mt-3 text-xs text-slate-400 bg-slate-50 rounded p-3 max-h-24 overflow-hidden whitespace-pre-wrap">
                  {tpl.template_body.slice(0, 200)}{tpl.template_body.length > 200 ? '…' : ''}
                </pre>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Template' : 'New Claim Template'} size="lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Template Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. BUPA Lebanon Outpatient"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Provider (optional — leave empty for generic)</label>
                <select
                  value={form.provider_id}
                  onChange={e => setForm(f => ({ ...f, provider_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Generic (fallback for all providers)</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Template Body (HTML with Handlebars-style placeholders)
                </label>
                <textarea
                  value={form.template_body}
                  onChange={e => setForm(f => ({ ...f, template_body: e.target.value }))}
                  rows={12}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="<html>...</html>"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Available placeholders: {'{{patient_name}}'}, {'{{doctor_name}}'}, {'{{clinic_name}}'}, {'{{policy_number}}'}, {'{{diagnosis}}'}, {'{{amount}}'}, {'{{date}}'}, {'{{provider_code}}'}
                </p>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
      </Modal>
    </div>
  );
}

function defaultTemplate(brandName) {
  const generatedBy = brandName || 'Clinic';
  return `<!DOCTYPE html>
<html>
<head><title>Insurance Claim — ${generatedBy}</title></head>
<body style="font-family: Arial, sans-serif; padding: 2rem;">
  <h1 style="text-align: center;">Insurance Claim Form</h1>
  <hr/>
  <table style="width: 100%; margin-top: 1rem;">
    <tr><td><strong>Patient:</strong></td><td>{{patient_name}}</td></tr>
    <tr><td><strong>Doctor:</strong></td><td>{{doctor_name}}</td></tr>
    <tr><td><strong>Clinic:</strong></td><td>{{clinic_name}}</td></tr>
    <tr><td><strong>Policy #:</strong></td><td>{{policy_number}}</td></tr>
    <tr><td><strong>Provider Code:</strong></td><td>{{provider_code}}</td></tr>
    <tr><td><strong>Date:</strong></td><td>{{date}}</td></tr>
    <tr><td><strong>Diagnosis:</strong></td><td>{{diagnosis}}</td></tr>
    <tr><td><strong>Amount:</strong></td><td>{{amount}}</td></tr>
  </table>
  <hr style="margin-top: 2rem;"/>
  <p style="text-align: center; font-size: 0.8rem; color: #888;">Generated by ${generatedBy}</p>
</body>
</html>`;
}
