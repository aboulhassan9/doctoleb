export default function Field({ label, htmlFor, hint, children }) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5">
      <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}
