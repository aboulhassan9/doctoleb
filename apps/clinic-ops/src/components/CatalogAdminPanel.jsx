import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@ui/contexts/ToastContext';
import { Modal, LoadingSkeleton } from '@ui/components/ui';
import { catalogService } from '@core/services/catalogs';
import { fadeUp } from '@core/lib/animations';

/**
 * CatalogAdminPanel — Reusable component for managing a catalog table.
 * Used by DoctorClinicalCatalogsPage and SecretaryOpsCatalogsPage.
 *
 * @param {{ catalogKey: string, catalogLabel: string }} props
 */
export default function CatalogAdminPanel({ catalogKey, catalogLabel }) {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await catalogService.getAll(catalogKey, {
      activeOnly: !showInactive,
      pageSize: 500,
    });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      setItems(result.data || []);
    }
    setLoading(false);
  }, [catalogKey, showInactive, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? items.filter((i) => (i.name || '').toLowerCase().includes(search.toLowerCase()) || (i.code || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const openCreate = () => {
    setModalMode('create');
    setEditing(null);
    setForm({ name: '', code: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    if (item.is_system) return;
    setModalMode('edit');
    setEditing(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      code: form.code || null,
      description: form.description || null,
      is_system: false,
    };
    const result = modalMode === 'edit'
      ? await catalogService.update(catalogKey, editing.id, payload)
      : await catalogService.create(catalogKey, payload);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`${catalogLabel} ${modalMode === 'edit' ? 'updated' : 'added'}.`, 'success');
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const handleDeactivate = async (item) => {
    if (item.is_system) {
      showToast('System entries cannot be deactivated.', 'error');
      return;
    }
    const result = await catalogService.update(catalogKey, item.id, { is_active: false });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`${item.name} deactivated.`, 'success');
      load();
    }
  };

  const handleReactivate = async (item) => {
    const result = await catalogService.update(catalogKey, item.id, { is_active: true });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`${item.name} reactivated.`, 'success');
      load();
    }
  };

  return (
    <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-800">{catalogLabel}</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/30" />
            Inactive
          </label>
          <button onClick={openCreate}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:brightness-110 transition-all flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>
            Add
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-6"><LoadingSkeleton rows={3} /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          No entries found. <button onClick={openCreate} className="text-primary underline font-medium">Add one</button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {filtered.map((item) => (
            <div key={item.id} className={`px-6 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{item.name}</span>
                  {item.is_system && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">System</span>
                  )}
                  {!item.is_active && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Inactive</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {item.code && <span className="text-xs text-slate-400 font-mono">{item.code}</span>}
                  {item.description && <span className="text-xs text-slate-400 truncate max-w-[200px]">{item.description}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!item.is_system && (
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                )}
                {!item.is_system && item.is_active && (
                  <button onClick={() => handleDeactivate(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                    <span className="material-symbols-outlined text-base">visibility_off</span>
                  </button>
                )}
                {!item.is_system && !item.is_active && (
                  <button onClick={() => handleReactivate(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                    <span className="material-symbols-outlined text-base">visibility</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal isOpen={showModal} onClose={() => setShowModal(false)}
            title={`${modalMode === 'edit' ? 'Edit' : 'Add'} ${catalogLabel}`}>
            <div className="space-y-4 p-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input type="text" value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Stable identifier (e.g. ICD-10 code)"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all">
                  {saving ? 'Saving…' : modalMode === 'edit' ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
