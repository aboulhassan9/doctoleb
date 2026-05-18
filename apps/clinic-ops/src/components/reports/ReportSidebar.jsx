/**
 * ReportSidebar — Right sidebar for report context, signature, and attachments.
 *
 * Replaces ~55 lines of inline sidebar from DoctorReportsPage.
 */
function formatReportReference(reportId) {
    if (!reportId) return 'Pending until saved';
    return `RPT-${String(reportId).replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export default function ReportSidebar({ reportId = null, onClearSignature = null }) {
    return (
        <div className="lg:col-span-4 space-y-8">
            {/* Report Context */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-2">Report Context</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Status</span>
                        <span className="px-2 py-1 bg-warning/10 text-amber-800 text-[10px] font-black uppercase rounded">Draft - Unsigned</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Priority</span>
                        <span className="px-2 py-1 bg-primary/10 text-blue-800 text-[10px] font-black uppercase rounded">Routine</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Ref No.</span>
                        <span className="text-xs font-bold font-mono">{formatReportReference(reportId)}</span>
                    </div>
                </div>
            </div>

            {/* Digital Signature */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center justify-between">
                    Digital Signature
                    <button
                        type="button"
                        disabled={!onClearSignature}
                        onClick={onClearSignature || undefined}
                        title={onClearSignature ? 'Clear signature' : 'Signature pad is not connected for this report yet.'}
                        className="text-primary text-[10px] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    >
                        Clear
                    </button>
                </h4>
                <div className="w-full h-48 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center relative overflow-hidden group bg-slate-50">
                    <span className="material-symbols-outlined text-slate-300 text-4xl group-hover:scale-110 transition-transform">draw</span>
                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 font-medium">Draw Signature Here</div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight italic">Signature capture is disabled until this report is saved and connected to the document rendering service.</p>
            </div>

            {/* Linked Attachments */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Linked Attachments</h4>
                <div className="space-y-2">
                    <div className="p-4 bg-slate-50 rounded-lg text-center">
                        <span className="material-symbols-outlined text-slate-300 text-2xl block mb-1">attach_file</span>
                        <p className="text-[10px] text-slate-400">No attachments yet. Attachments will appear here when linked to this report.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
