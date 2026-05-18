/**
 * ReportSidebar — Right sidebar for report context, signature, and attachments.
 *
 * Replaces ~55 lines of inline sidebar from DoctorReportsPage.
 */
function formatReportReference(reportId) {
    if (!reportId) return 'Pending until saved';
    return `RPT-${String(reportId).replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export default function ReportSidebar({
    reportId = null,
    purpose = null,
    readiness = null,
    documents = [],
    lastSavedAt = null,
    onExport = null,
}) {
    const readinessItems = readiness?.items || [];
    const canExport = Boolean(onExport && reportId);

    return (
        <div className="lg:col-span-4 space-y-8">
            {/* Report Context */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-2">Report Context</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Status</span>
                        <span className="px-2 py-1 bg-warning/10 text-amber-800 text-[10px] font-black uppercase rounded">
                            {reportId ? 'Saved Draft' : 'Unsaved Draft'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Purpose</span>
                        <span className="max-w-[12rem] truncate text-right text-xs font-bold text-slate-800">{purpose?.label || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Ref No.</span>
                        <span className="text-xs font-bold font-mono">{formatReportReference(reportId)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Last save</span>
                        <span className="text-xs font-bold text-slate-700">{lastSavedAt || 'Not saved yet'}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100 pb-2">Readiness</h4>
                <div className="space-y-2">
                    {readinessItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-2">
                            <span className={`material-symbols-outlined mt-0.5 text-[16px] ${item.complete ? 'text-emerald-600' : item.blocking ? 'text-amber-600' : 'text-slate-300'}`}>
                                {item.complete ? 'check_circle' : item.blocking ? 'error' : 'radio_button_unchecked'}
                            </span>
                            <span className={`text-xs font-semibold ${item.complete ? 'text-slate-700' : item.blocking ? 'text-amber-800' : 'text-slate-400'}`}>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Digital Signature */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center justify-between">
                    Digital Signature
                    <button
                        type="button"
                        disabled
                        title="Signature is collected in the final document review step after renderer support is available."
                        className="text-primary text-[10px] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    >
                        Final step
                    </button>
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-slate-400">edit_document</span>
                        <p className="text-xs leading-relaxed text-slate-500">
                            Signature is intentionally not captured in this side panel. The doctor should sign the final rendered document preview so the signature position matches the exported PDF.
                        </p>
                    </div>
                </div>
            </div>

            {/* Linked Attachments */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Linked Attachments</h4>
                <div className="space-y-2">
                    <div className="p-4 bg-slate-50 rounded-lg text-center">
                        <span className="material-symbols-outlined text-slate-300 text-2xl block mb-1">attach_file</span>
                        <p className="text-[10px] text-slate-400">
                            {documents.length ? `${documents.length} patient documents are available to reference above.` : 'No prior patient documents found yet.'}
                        </p>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={onExport || undefined}
                disabled={!canExport}
                title={canExport ? 'Open the latest rendered report artifact.' : 'PDF export requires a saved report and renderer artifact.'}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
            >
                Export PDF when renderer artifact exists
            </button>
        </div>
    );
}
