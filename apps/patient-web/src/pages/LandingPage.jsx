import React from 'react';
import { Link } from 'react-router-dom';
import { useBrand } from '@/contexts/BrandContext';

const patientActions = [
  'Request appointments and review visits shared by the clinic.',
  'Complete intake information before the doctor reviews it.',
  'Receive clinic reminders and follow-up instructions in one place.',
  'Open medical documents and forms that the clinic shares with you.',
  'Message the clinic securely from your private patient account.',
];

const staffBoundaryNotes = [
  'Patients use this website for registration, appointments, records, and clinic messages.',
  'Doctors and staff use a separate operations portal that is never exposed here.',
  'Clinical workflows remain protected behind staff authentication and role permissions.',
];

function ContactLink({ href, children }) {
  if (!href || !children) return null;

  return (
    <a className="font-bold text-inherit underline decoration-[var(--patient-warning)] decoration-2 underline-offset-4 transition hover:decoration-white" href={href}>
      {children}
    </a>
  );
}

function formatPhoneHref(phone) {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!/^[+\d][\d\s().-]{4,24}$/.test(trimmed)) return null;
  return `tel:${trimmed.replace(/[^\d+]/g, '')}`;
}

function formatEmailHref(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${encodeURIComponent(trimmed)}`;
}

function formatWebsiteHref(websiteUrl) {
  if (typeof websiteUrl !== 'string') return null;
  try {
    const parsed = new URL(websiteUrl.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch (_error) {
    return null;
  }
}

function LandingPage() {
  const { brand, displayName, tagline } = useBrand();
  const doctorName = brand.doctor_display_name && brand.doctor_display_name !== displayName ? brand.doctor_display_name : null;
  const doctorTagline = brand.doctor_tagline || tagline;
  const aboutText = typeof brand.about_md === 'string' ? brand.about_md.trim() : '';
  const logoUrl = brand.doctor_logo_url || brand.logo_url || brand.favicon_url;
  const phone = brand.doctor_contact_phone || brand.contact_phone;
  const email = brand.doctor_contact_email || brand.contact_email;
  const websiteUrl = brand.doctor_website_url || brand.website_url;
  const phoneHref = formatPhoneHref(phone);
  const emailHref = formatEmailHref(email);
  const websiteHref = formatWebsiteHref(websiteUrl);
  const hasContact = phoneHref || emailHref || websiteHref;

  return (
    <div className="patient-sanctuary patient-grain min-h-screen">
      <header className="patient-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img className="patient-brand-lockup h-12 w-12 object-cover" src={logoUrl} alt={`${displayName} logo`} />
            ) : (
              <div className="patient-avatar h-12 w-12 text-lg">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-black text-[var(--patient-ink)]">{displayName}</p>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--patient-muted)]">Clinic website</p>
            </div>
          </div>
          <nav className="hidden items-center gap-5 text-sm font-bold text-[var(--patient-muted)] sm:flex">
            <a className="transition hover:text-[var(--patient-ink)]" href="#services">Services</a>
            <a className="transition hover:text-[var(--patient-ink)]" href="#contact">Contact</a>
            <Link className="patient-button-primary px-5 py-2.5" to="/login">
              Patient Login
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-20 sm:py-28">
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="patient-kicker">Doctor-led clinic access</p>
              <h1 className="patient-display mt-5 text-6xl font-medium leading-[0.94] tracking-tight sm:text-7xl">
                Patient care starts here.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--patient-muted)]">
                This is the official patient website for {displayName}. {doctorTagline}
              </p>
              {doctorName ? (
                <p className="patient-status-sage mt-4 uppercase tracking-wide">
                  Led by {doctorName}
                </p>
              ) : null}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="patient-button-primary px-6 py-3 text-center" to="/signup">
                  Patient Registration
                </Link>
                <Link className="patient-button-secondary px-6 py-3 text-center" to="/login">
                  Patient Login
                </Link>
              </div>
            </div>

            <aside className="patient-paper-strong patient-surface p-6">
              <p className="patient-kicker">Available patient services</p>
              <ul className="mt-5 grid gap-3">
                {patientActions.map((action) => (
                  <li key={action} className="patient-inset p-4 text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                    {action}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section id="services" className="px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <section className="patient-paper patient-surface p-7">
              <h2 className="patient-display text-3xl font-medium">About this clinic</h2>
              <p className="mt-4 leading-7 text-[var(--patient-muted)]">
                {aboutText || `${displayName} uses this website to help patients start registration, request care, and stay aligned with the doctor and clinical team.`}
              </p>
            </section>

            <section className="patient-paper patient-surface p-7">
              <h2 className="patient-display text-3xl font-medium">Private patient access</h2>
              <ul className="mt-4 grid gap-3">
                {staffBoundaryNotes.map((note) => (
                  <li key={note} className="text-sm font-semibold leading-6 text-[var(--patient-muted)]">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section id="contact" className="px-6 pb-24">
          <div className="patient-hero-band mx-auto max-w-6xl p-7">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--patient-warning)]">Contact the clinic</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <ContactLink href={phoneHref}>{phone}</ContactLink>
              <ContactLink href={emailHref}>{email}</ContactLink>
              <ContactLink href={websiteHref}>{websiteUrl}</ContactLink>
              {!hasContact ? (
                <span className="text-white/70">Contact details will appear here when the clinic adds them.</span>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
