import PatientPageHeader from './PatientPageHeader';

const WIDTH_CLASS = {
  default: 'max-w-7xl',
  narrow: 'max-w-5xl',
  wide: 'max-w-[92rem]',
};

export function PatientPortalShell({
  title,
  subtitle,
  children,
  className = '',
  mainClassName = '',
  width = 'default',
  showBackToDashboard = true,
  showLogout = true,
}) {
  const maxWidth = WIDTH_CLASS[width] || WIDTH_CLASS.default;

  return (
    <div className={`patient-sanctuary patient-grain patient-portal-shell min-h-screen ${className}`}>
      <PatientPageHeader
        title={title}
        subtitle={subtitle}
        showBackToDashboard={showBackToDashboard}
        showLogout={showLogout}
      />
      <main className={`patient-portal-main mx-auto w-full ${maxWidth} px-4 py-8 sm:px-6 lg:px-8 ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
}

export function PatientPortalHero({ eyebrow, title, children, aside = null }) {
  return (
    <section className="patient-portal-hero">
      <div className="min-w-0">
        {eyebrow ? <p className="patient-kicker">{eyebrow}</p> : null}
        <h1 className="patient-display mt-3 max-w-4xl text-5xl font-medium leading-[0.96] tracking-tight sm:text-6xl">
          {title}
        </h1>
        {children ? <div className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[var(--patient-muted)]">{children}</div> : null}
      </div>
      {aside ? <div className="patient-portal-hero-aside">{aside}</div> : null}
    </section>
  );
}

export function PatientSurface({ as: Component = 'section', tone = 'paper', className = '', children, ...props }) {
  const toneClass = tone === 'strong' ? 'patient-paper-strong' : 'patient-paper';
  return (
    <Component className={`${toneClass} patient-surface ${className}`} {...props}>
      {children}
    </Component>
  );
}
