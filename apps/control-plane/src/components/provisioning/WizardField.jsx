export default function WizardField({ label, children, help }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs text-slate-400">{help}</span> : null}
    </label>
  )
}
