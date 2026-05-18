/**
 * BillSummaryCard — sticky right-column showing totals, invoice draft, and action buttons.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function BillSummaryCard({
    subtotal,
    totalDue,
    paymentMethod,
    invoiceStatus,
    submitState,
    onSavePost,
    onSavePrint,
    paymentReference,
}) {
    const navigate = useNavigate();

    return (
        <div className="sticky top-28 space-y-8">
            {/* Summary Card */}
            <section className="bg-white border-2 border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 transform transition-transform hover:scale-[1.01]">
                <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top--10 right--10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-black tracking-tight">Payment Summary</h3>
                            <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10">In Draft</div>
                        </div>
                        <p className="text-slate-400 text-xs font-bold font-mono">{paymentReference || 'Server reference appears after posting'}</p>
                    </div>
                </div>

                <div className="p-8 space-y-5">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Gross Subtotal</span>
                        <span className="font-black text-slate-900 tabular-nums">${subtotal.toFixed(2)}</span>
                    </div>

                    {paymentMethod === 'insurance' ? (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-amber-600 font-bold uppercase tracking-widest text-[10px]">Claim Status</span>
                            <span className="font-black text-amber-700 tabular-nums">Pending payer review</span>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sales Tax (Exempt)</span>
                            <span className="font-black text-slate-900 tabular-nums">$0.00</span>
                        </div>
                    )}

                    <div className="pt-6 border-t-2 border-slate-100 border-dashed">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <span className="text-slate-900 font-black text-lg block leading-none mb-1">Total Due</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Wait for processing</span>
                            </div>
                            <div className="text-right">
                                <motion.span
                                    key={totalDue}
                                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                                    className="text-[42px] font-black text-primary leading-none tracking-tighter tabular-nums block"
                                >
                                    ${totalDue.toFixed(2)}
                                </motion.span>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 mr-1 text-right">USD</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 bg-primary/5 flex items-start gap-4 border-t border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                        {paymentMethod === 'insurance'
                            ? "No automated coverage is applied here. Use the insurance workflow to verify payer responsibility before settlement."
                            : "Verify physical cash or electronic proof of payment before finalizing this transaction."}
                    </p>
                </div>
            </section>

            {/* Action Stack */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={onSavePost}
                    disabled={submitState === 'processing'}
                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group disabled:opacity-80 disabled:cursor-wait"
                >
                    {submitState === 'processing' ? (
                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="material-symbols-outlined text-2xl">progress_activity</motion.span>
                    ) : (
                        <span className="material-symbols-outlined text-2xl group-hover:animate-bounce">cloud_upload</span>
                    )}
                    {submitState === 'processing' ? 'Processing Transaction...' : 'Save & Post Bill'}
                </button>

                <button
                    onClick={onSavePrint}
                    disabled={submitState === 'processing'}
                    className="w-full py-5 bg-white border-2 border-slate-200 text-slate-700 rounded-[1.5rem] font-black text-lg hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-wait"
                >
                    <span className="material-symbols-outlined text-2xl">print</span>
                    Save, Post & Print Receipt
                </button>

                <button
                    onClick={() => navigate('/billing')}
                    className="w-full py-4 text-slate-400 font-black text-xs hover:text-critical hover:bg-red-50 rounded-xl transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                    Cancel Transaction
                </button>
            </div>
        </div>
    );
}
