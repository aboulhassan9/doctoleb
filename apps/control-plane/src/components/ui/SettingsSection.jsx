export function SettingsSection({ title, description, icon: Icon, headerAction, children }) {
  return (
    <section className="flex flex-col gap-5 border-b border-slate-200 pb-10 last:border-0 last:pb-0 lg:flex-row lg:gap-10">
      <div className="flex flex-col gap-3 lg:w-72 lg:shrink-0">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        </div>
        {description && <p className="text-sm leading-relaxed text-slate-500">{description}</p>}
        {headerAction && <div>{headerAction}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
