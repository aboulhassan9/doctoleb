/**
 * ReportFormSection — Reusable report section with icon header and textarea.
 *
 * Replaces ~20 lines of repetitive section markup per section in DoctorReportsPage.
 */
export default function ReportFormSection({
    icon,
    title,
    value,
    onChange,
    placeholder,
    helperText = '',
    required = false,
    rows = 3,
    bold = false,
    actions = [],
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-slate-700">
                        <span className="material-symbols-outlined text-base text-primary">{icon}</span>
                        {title}
                        {required ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">Required</span> : null}
                    </h3>
                    {helperText ? <p className="mt-1 max-w-2xl truncate text-[11px] font-semibold normal-case leading-relaxed tracking-normal text-slate-400">{helperText}</p> : null}
                </div>
                {actions.length > 0 ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                disabled={action.disabled}
                                title={action.disabledReason || action.label}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 disabled:hover:bg-white"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="p-4">
                <textarea
                    aria-label={title}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full resize-none rounded-xl border border-transparent bg-white p-2 text-sm leading-relaxed outline-none transition focus:border-primary/30 focus:bg-primary/5 focus:ring-4 focus:ring-primary/10 ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}
                    placeholder={placeholder}
                    style={{ minHeight: `${rows * 26}px` }}
                />
            </div>
        </div>
    );
}
