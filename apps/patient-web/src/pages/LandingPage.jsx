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
    <a className="font-bold text-primary transition hover:text-primary-hover" href={href}>
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
    <div className="min-h-screen bg-background-light text-slate-950 dark:bg-background-dark dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img className="h-12 w-12 rounded-2xl object-cover" src={logoUrl} alt={`${displayName} logo`} />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-black text-white">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-black">{displayName}</p>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Clinic website</p>
            </div>
          </div>
          <nav className="hidden items-center gap-5 text-sm font-bold text-slate-500 sm:flex">
            <a className="transition hover:text-slate-950 dark:hover:text-white" href="#services">Services</a>
            <a className="transition hover:text-slate-950 dark:hover:text-white" href="#contact">Contact</a>
            <Link className="rounded-full bg-slate-950 px-5 py-2.5 text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950" to="/login">
              Patient Login
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgb(var(--color-primary-rgb)_/_0.18),transparent_32%),radial-gradient(circle_at_18%_82%,rgb(var(--color-secondary-rgb)_/_0.10),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Doctor-led clinic access</p>
              <h1 className="mt-5 text-5xl font-black leading-tight tracking-[-0.04em] sm:text-6xl">
                Patient care starts here.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                This is the official patient website for {displayName}. {doctorTagline}
              </p>
              {doctorName ? (
                <p className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                  Led by {doctorName}
                </p>
              ) : null}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="rounded-2xl bg-primary px-6 py-3 text-center font-black text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary-hover" to="/signup">
                  Patient Registration
                </Link>
                <Link className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white" to="/login">
                  Patient Login
                </Link>
              </div>
            </div>

            <aside className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Available patient services</p>
              <ul className="mt-5 grid gap-3">
                {patientActions.map((action) => (
                  <li key={action} className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {action}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section id="services" className="px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <section className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <h2 className="text-2xl font-black">About this clinic</h2>
              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
                {aboutText || `${displayName} uses this website to help patients start registration, request care, and stay aligned with the doctor and clinical team.`}
              </p>
            </section>

            <section className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <h2 className="text-2xl font-black">Private patient access</h2>
              <ul className="mt-4 grid gap-3">
                {staffBoundaryNotes.map((note) => (
                  <li key={note} className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section id="contact" className="px-6 pb-24">
          <div className="mx-auto max-w-6xl rounded-[2rem] bg-slate-950 p-7 text-white dark:bg-white dark:text-slate-950">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">Contact the clinic</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <ContactLink href={phoneHref}>{phone}</ContactLink>
              <ContactLink href={emailHref}>{email}</ContactLink>
              <ContactLink href={websiteHref}>{websiteUrl}</ContactLink>
              {!hasContact ? (
                <span className="text-slate-300 dark:text-slate-600">Contact details will appear here when the clinic adds them.</span>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
