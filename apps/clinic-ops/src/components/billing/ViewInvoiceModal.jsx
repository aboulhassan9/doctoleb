/**
 * ViewInvoiceModal — read-only detail view for a selected invoice.
 */
import { motion } from 'framer-motion';

export default function ViewInvoiceModal({ invoice, onClose, onPrint, onEdit }) {
    if (!invoice) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-900">Invoice Details</h2>
                    <div className="flex gap-2">
                        <button onClick={() => onPrint(invoice)} className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors">
                            <span className="material-symbols-outlined">print</span>
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div className="p-10 max-h-[70vh] overflow-y-auto">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Invoice Reference</p>
                            <h3 className="text-3xl font-black text-slate-900">{invoice.id}</h3>
                            <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-tighter">Status: {invoice.status}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Amount Due</p>
                            <p className="text-3xl font-black text-slate-900">${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-100 mb-8">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
                            <p className="text-lg font-semibold text-slate-900">{invoice.patient}</p>
                            <p className="text-xs text-slate-500 mt-1">Patient ID: CP-{invoice.id.replace(/\D/g, '')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Issue Date</p>
                            <p className="text-lg font-bold text-slate-900">{invoice.date}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Service Description</p>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-slate-900">Clinical Services & Consultation</p>
                                <p className="text-xs text-slate-500 mt-1">General medical evaluation and follow-up.</p>
                            </div>
                            <p className="font-black text-slate-900">${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Close</button>
                    <button onClick={() => onEdit(invoice)} className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">Edit Invoice</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
