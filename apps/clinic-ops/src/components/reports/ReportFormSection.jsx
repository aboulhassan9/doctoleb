/**
 * ReportFormSection — Reusable report section with icon header and textarea.
 *
 * Replaces ~20 lines of repetitive section markup per section in DoctorReportsPage.
 */
export default function ReportFormSection({ icon, title, value, onChange, placeholder, rows = 3, bold = false }) {
    return (
        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
            <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
                    {title}
                </h3>
            </div>
            <div className="p-6">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full border-none focus:ring-0 p-0 text-sm leading-relaxed min-h-[${rows * 30}px] bg-transparent resize-none ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}
                    placeholder={placeholder}
                    style={{ minHeight: `${rows * 30}px` }}
                />
            </div>
        </div>
    );
}
