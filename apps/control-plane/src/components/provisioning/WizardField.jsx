export default function WizardField({ label, children, help }) {
  return (
    <label className="grid gap-1.5">
      <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {help ? <span className="text-xs leading-relaxed text-slate-400">{help}</span> : null}
    </label>
  )
}
