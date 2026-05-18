/**
 * BillSuccessModal — overlay shown after a bill is successfully posted.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function BillSuccessModal({ totalDue, paymentMethod, invoiceStatus, paymentReference, onDownloadReceipt, isDownloading }) {
    const navigate = useNavigate();

    return (
        <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
            <motion.div
                key="success-card"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col items-center p-8 border border-white/20 relative"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-xl pointer-events-none" />

                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 relative z-10">
                    <span className="material-symbols-outlined text-5xl text-success" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2 relative z-10">Payment Posted!</h2>
                <p className="text-slate-500 text-center font-medium mb-8 relative z-10">
                    Payment reference <span className="font-bold text-slate-700">{paymentReference}</span> has been recorded in the tenant ledger.
                </p>

                <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 relative z-10">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Amount</span>
                        <span className="text-lg font-black text-slate-900">${totalDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-200/60">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Method</span>
                        <span className="text-sm font-bold text-slate-900 capitalize">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</span>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${
                            invoiceStatus === 'completed' ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {invoiceStatus === 'completed' ? 'Paid In Full' : 'Pending Claim'}
                        </span>
                    </div>
                </div>

                <div className="w-full flex gap-3 relative z-10">
                    <button
                        onClick={onDownloadReceipt}
                        disabled={isDownloading}
                        className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                        <motion.span
                            animate={isDownloading ? { rotate: 360 } : {}}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="material-symbols-outlined text-[18px]"
                        >
                            {isDownloading ? 'progress_activity' : 'print'}
                        </motion.span>
                        {isDownloading ? 'Preparing...' : 'Print Receipt'}
                    </button>
                    <button
                        onClick={() => navigate('/billing')}
                        className="flex-[1.5] flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Return to Billing
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
