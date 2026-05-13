/**
 * EditInvoiceModal — edit an existing invoice's patient, amount, status, and date.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function EditInvoiceModal({ invoice, onClose, onSave }) {
    const [form, setForm] = useState(null);

    useEffect(() => {
        if (invoice) setForm({ ...invoice });
    }, [invoice]);

    if (!form) return null;

    const handleStatusChange = (s) => {
        const cls = s === 'Paid' ? 'bg-success/10 text-success' : s === 'Pending' ? 'bg-warning/10 text-warning' : 'bg-error-container text-on-error-container';
        setForm({ ...form, status: s, statusCls: cls });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Edit Invoice</h2>
                        <p className="text-sm text-slate-500 font-medium">Updating {form.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Patient Name</label>
                        <input type="text" value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Bill Amount ($)</label>
                            <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black tabular-nums text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Status</label>
                            <select value={form.status} onChange={e => handleStatusChange(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all">
                                <option value="Paid">Paid</option>
                                <option value="Pending">Pending</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Effective Date</label>
                        <input type="text" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                    </div>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-4 text-sm font-medium text-slate-500 hover:bg-white rounded-2xl transition-all">Discard Changes</button>
                    <button onClick={() => onSave(form)} className="flex-[2] py-4 bg-slate-900 text-white font-semibold rounded-2xl shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Save Changes</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
