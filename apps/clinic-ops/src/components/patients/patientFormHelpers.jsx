/**
 * Shared constants and micro-components for patient forms.
 */

/* ── Blank registration form state ── */
export const BLANK_FORM = {
    fullName:     '',
    dob:          '',
    gender:       '',
    phone:        '',
    email:        '',
    address:      '',
    emergName:    '',
    emergPhone:   '',
    insurance:    '',
    policy:       '',
};

/* ── Shared input class string ── */
export const inputCls =
    'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300';

/* ── Field wrapper — label + input ── */
export function Field({ label, children }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            {children}
        </div>
    );
}

/* ── Section card wrapper — icon + title + body ── */
export function Section({ icon, title, children }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

/* ── Row animation variant ── */
export const rowAnim = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
