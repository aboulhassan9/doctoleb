import { useState } from 'react';
import { LoadingSkeleton, EmptyState, StatusBadge } from '@/components/ui';
import { INPUT_CLASS, TEXTAREA_CLASS, BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/lib/styles';

export default function EncounterOrdersTab({ labOrders, imagingOrders, loading, isSaving, onCreateOrder, encounterId, patientId, doctorId, orderedBy, isActive = false }) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState('lab');
  const [form, setForm] = useState({ title: '', imaging_type: '', body_area: '', instructions: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const titleVal = kind === 'lab' ? form.title : form.imaging_type;
    if (!titleVal?.trim()) return;
    const payload = {
      encounter_id: encounterId, patient_id: patientId, doctor_id: doctorId, ordered_by: orderedBy, status: 'ordered',
      ...(kind === 'lab' ? { title: form.title.trim() } : { imaging_type: form.imaging_type.trim(), body_area: form.body_area.trim() || null }),
      instructions: form.instructions.trim() || null,
    };
    const success = await onCreateOrder(kind, payload);
    if (success) { setForm({ title: '', imaging_type: '', body_area: '', instructions: '' }); setShowForm(false); }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  const allOrders = [...(labOrders || []), ...(imagingOrders || [])];

  return (
    <div className="space-y-4">
      {isActive && !showForm && (
        <button onClick={() => setShowForm(true)} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
          <span className="material-symbols-outlined text-lg">add</span>New Order
        </button>
      )}
      {isActive && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">New Order</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            {['lab', 'imaging'].map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${kind === k ? 'bg-primary/10 text-primary border-primary/30' : 'bg-white text-slate-500 border-slate-200'}`}>
                {k === 'lab' ? '🔬 Lab' : '📷 Imaging'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kind === 'lab' ? (
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Lab Test *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Complete Blood Count" className={INPUT_CLASS} autoFocus />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Imaging Type *</label>
                  <input type="text" value={form.imaging_type} onChange={(e) => setForm({ ...form, imaging_type: e.target.value })} placeholder="e.g. X-Ray" className={INPUT_CLASS} autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Body Area</label>
                  <input type="text" value={form.body_area} onChange={(e) => setForm({ ...form, body_area: e.target.value })} placeholder="e.g. Chest" className={INPUT_CLASS} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Instructions</label>
              <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Clinical indications..." rows={2} className={TEXTAREA_CLASS} />
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className={BUTTON_SECONDARY}>Cancel</button>
            <button type="submit" disabled={!(kind === 'lab' ? form.title : form.imaging_type)?.trim() || isSaving} className={`${BUTTON_PRIMARY} flex items-center gap-2`}>
              {isSaving && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}Save
            </button>
          </div>
        </form>
      )}
      {allOrders.length === 0 ? (
        <EmptyState icon="science" title="No orders" subtitle="Create lab or imaging orders for this encounter." />
      ) : (
        <div className="space-y-3">
          {labOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lab Orders</h4>
              {labOrders.map((o) => <OrderCard key={o.id} order={o} icon="biotech" />)}
            </div>
          )}
          {imagingOrders.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Imaging Orders</h4>
              {imagingOrders.map((o) => <OrderCard key={o.id} order={o} icon="radiology" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        <h4 className="text-sm font-bold text-slate-900">{order.title || order.imaging_type || 'Order'}</h4>
        <StatusBadge status={order.status} size="sm" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
        {order.body_area && <span>Area: {order.body_area}</span>}
        {order.result_summary && <span>Result: {order.result_summary}</span>}
      </div>
      {order.instructions && <p className="text-xs text-slate-400 mt-2 italic">{order.instructions}</p>}
    </div>
  );
}
