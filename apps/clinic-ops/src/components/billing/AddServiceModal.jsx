/**
 * AddServiceModal — modal for selecting and adding billable services to a bill.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AddServiceModal({ availableServices, onConfirm, onClose }) {
    const [serviceIdx, setServiceIdx] = useState(0);
    const [qty, setQty] = useState(1);

    const svc = availableServices[serviceIdx];
    const lineTotal = svc ? parseFloat(svc.price) * qty : 0;

    const handleConfirm = () => {
        if (svc) {
            onConfirm({
                name: svc.name,
                code: svc.code,
                price: parseFloat(svc.price),
                desc: svc.description,
                quantity: qty,
            });
        }
        onClose();
    };

    return (
        <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                key="modal-card"
                initial={{ scale: 0.92, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 24 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-white overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Service</h2>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Bill a procedure or test to this patient</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors mt-0.5">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Service Selector */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Select Service</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">search</span>
                            <select
                                value={serviceIdx}
                                onChange={e => setServiceIdx(Number(e.target.value))}
                                className="w-full pl-10 pr-10 py-3 bg-slate-100 border-none rounded-xl text-sm font-semibold text-slate-900 appearance-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                            >
                                {availableServices.length === 0 && <option value={0}>Loading services...</option>}
                                {availableServices.map((s, i) => (
                                    <option key={s.code} value={i}>{s.name} - ${parseFloat(s.price).toFixed(2)}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* Price + Quantity */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Unit Price</p>
                            <motion.div key={svc?.price || 0} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-baseline gap-1">
                                <span className="text-slate-400 font-bold text-sm">$</span>
                                <span className="text-xl font-black text-slate-900">{svc ? parseFloat(svc.price).toFixed(2) : '0.00'}</span>
                            </motion.div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                            <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 text-slate-600 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                </button>
                                <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-transparent border-none text-center font-black text-slate-900 focus:ring-0 p-0 text-sm" />
                                <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 text-slate-600 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Live Total */}
                    <motion.div key={lineTotal} initial={{ scale: 0.97 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-[18px]">payments</span>
                            </div>
                            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Total Cost</p>
                        </div>
                        <p className="text-2xl font-black text-primary">${lineTotal.toFixed(2)}</p>
                    </motion.div>
                </div>

                {/* Footer */}
                <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all">Cancel</button>
                    <button onClick={handleConfirm} className="flex-[1.5] px-4 py-3 bg-primary text-white font-black rounded-xl text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Add Service
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
