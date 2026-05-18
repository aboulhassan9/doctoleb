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
        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
            <div className="bg-slate-50 px-6 py-3 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
                        {title}
                        {required ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">Required</span> : null}
                    </h3>
                    {helperText ? <p className="mt-1 max-w-2xl text-xs font-medium normal-case leading-relaxed tracking-normal text-slate-500">{helperText}</p> : null}
                </div>
                {actions.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                disabled={action.disabled}
                                title={action.disabledReason || action.label}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="p-6">
                <textarea
                    aria-label={title}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed focus:ring-0 ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}
                    placeholder={placeholder}
                    style={{ minHeight: `${rows * 30}px` }}
                />
            </div>
        </div>
    );
}
