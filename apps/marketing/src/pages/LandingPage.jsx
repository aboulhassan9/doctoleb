import { useState } from 'react'
import { motion } from 'framer-motion'
import { submitMarketingLead } from '../services/leadCapture'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

const TRUST_POINTS = [
  { icon: 'lock', title: 'Per-clinic database', body: 'Each clinic gets its own Postgres. Your patient data never mixes with another clinic.' },
  { icon: 'verified_user', title: 'Zero-PHI control plane', body: 'Billing, plans, routing live in a separate system. Patient data lives only in your clinic.' },
  { icon: 'bolt', title: 'Live in ~2 minutes', body: 'No tickets, no scheduling calls. Pay and your clinic is ready.' },
]

const FEATURES = [
  {
    icon: 'event_available',
    title: 'Smart scheduling',
    body: 'Doctors, secretaries, and patients see the same live slots. Atomic booking — no double-booked appointments, no race conditions.',
  },
  {
    icon: 'stethoscope',
    title: 'Clinical encounters',
    body: 'Open a visit, take SOAP notes, write prescriptions, order labs and imaging. Autosaving drafts so a tab close never loses work.',
  },
  {
    icon: 'receipt_long',
    title: 'Built-in billing',
    body: 'Generate the invoice the moment the visit completes. Track pending, completed, refunded payments in one ledger.',
  },
  {
    icon: 'forum',
    title: 'Secure patient messaging',
    body: 'Patients message your clinic in a private inbox. Sensitive content is redaction-aware. Never another lost WhatsApp thread.',
  },
  {
    icon: 'health_and_safety',
    title: 'Pre-doctor triage',
    body: 'Optional pre-visit forms collect vitals, complaints, and history so the doctor walks into the room already up to speed.',
  },
  {
    icon: 'palette',
    title: 'Your brand, not ours',
    body: 'Patients see your clinic name, logo, and colors — not "DoctoLeb". Your domain. Your relationship. Your trust.',
  },
]

const STEPS = [
  { num: '01', title: 'Tell us your clinic name', body: 'Your slug, your contact email, your branding. Takes 30 seconds.' },
  { num: '02', title: 'We provision your clinic', body: 'A private Postgres database, branded login pages, and your team invites — all wired automatically.' },
  { num: '03', title: 'Invite your team and open the doors', body: 'Add your secretary and pre-doctor, share the patient signup link, and start booking.' },
]

const PRICING = [
  {
    name: 'Solo',
    price: '$29',
    cadence: 'per month',
    blurb: 'For a single doctor running their own practice.',
    features: [
      '1 doctor',
      'Unlimited patients & appointments',
      'Clinical encounters, prescriptions, lab orders',
      'Patient messaging',
      'Shared `your-slug.doctoleb.com` routing',
      'Email support',
    ],
    cta: 'Get notified',
    highlight: false,
  },
  {
    name: 'Practice',
    price: '$79',
    cadence: 'per month',
    blurb: 'For multi-doctor clinics with a front desk and a pre-doctor team.',
    features: [
      'Up to 5 doctors',
      '1 secretary, 2 pre-doctors',
      'Everything in Solo',
      'Custom domain (e.g. clinic.com)',
      'Branded patient portal',
      'Priority support',
    ],
    cta: 'Get notified',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'tailored',
    blurb: 'Multi-location groups, integrations, or compliance reviews.',
    features: [
      'Unlimited doctors and staff',
      'Multi-location support',
      'SSO and custom integrations',
      'Dedicated onboarding',
      'Compliance review on request',
      'Named support contact',
    ],
    cta: 'Talk to us',
    highlight: false,
  },
]

const FAQ = [
  {
    q: 'Who owns the patient data?',
    a: 'You do. Each clinic gets its own Postgres database — your data never mixes with another clinic. If you ever leave, you take an export and we delete what remained on our side.',
  },
  {
    q: 'How secure is it for medical data?',
    a: 'Every tenant database has Row-Level Security on every exposed table. The DoctoLeb control plane stores zero PHI — only routing, plans, and provisioning metadata. Clinical attachments live in private buckets with short-lived signed URLs.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'Yes — available on Practice and Enterprise plans. Verify DNS once, we wire SSL and routing for you. On Solo, your clinic lives at `your-slug.doctoleb.com`.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Subscription cancels at the end of the current period. You can export your patients, appointments, and clinical history before the tenant is archived.',
  },
  {
    q: 'Do I need technical knowledge?',
    a: 'No. If you can use email, you can use DoctoLeb. We do the setup. You name your clinic and invite your team.',
  },
  {
    q: 'Does it work in Arabic or French?',
    a: 'The platform is built with multi-language in mind. Arabic and French interfaces are on the roadmap; English is the launch language.',
  },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: 'easeOut' },
}

function MaterialIcon({ name, className = '' }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-900/5 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <a href="#top" className="flex items-center gap-2.5 text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-sky-400">
            <MaterialIcon name="medical_services" className="text-[20px]" />
          </span>
          <span className="text-lg font-black tracking-tight">DoctoLeb</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} className="transition hover:text-slate-900" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#cta"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700"
        >
          Start your clinic
          <MaterialIcon name="arrow_forward" className="text-[18px]" />
        </a>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-slate-950 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-10 lg:pt-32">
        <motion.div {...fadeUp} className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Now onboarding clinics
          </span>
          <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Your clinic,<br />
            <span className="bg-gradient-to-r from-sky-300 via-sky-400 to-emerald-300 bg-clip-text text-transparent">
              online and in your hands.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
            DoctoLeb is the modern operating system for independent doctors. Appointments, clinical encounters, billing, and secure patient messaging — in one platform, isolated to your clinic, ready in under two minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-slate-900 shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-100"
            >
              Start your clinic
              <MaterialIcon name="arrow_forward" className="text-[18px]" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/5"
            >
              See pricing
            </a>
          </div>
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Per-clinic database isolation · Zero-PHI control plane · Built for solo and small clinics
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function TrustBand() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-3 lg:px-10">
        {TRUST_POINTS.map((point) => (
          <div key={point.title} className="flex items-start gap-4">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-slate-900 text-sky-400">
              <MaterialIcon name={point.icon} className="text-[22px]" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">{point.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{point.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div {...fadeUp} className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Features</span>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
            Built for how a real clinic runs.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Not a generic CRM. Not a patient portal bolted onto a calendar. DoctoLeb covers the full clinical day — booking through billing — without leaving the app.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: idx * 0.05 }}
              className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-slate-900 hover:shadow-lg"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-sky-400 transition group-hover:bg-sky-500 group-hover:text-white">
                <MaterialIcon name={feature.icon} className="text-[24px]" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div {...fadeUp} className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">How it works</span>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
            From signup to first patient in minutes.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            No installations. No DevOps. No invoicing back-and-forth with a vendor. DoctoLeb provisions your private clinic automatically.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.num}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: idx * 0.08 }}
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-8"
            >
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">Step {step.num}</span>
              <h3 className="mt-3 text-2xl font-bold leading-tight text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.body}</p>
              <span
                aria-hidden="true"
                className="absolute -bottom-10 -right-6 text-[10rem] font-black leading-none text-slate-900/5"
              >
                {step.num}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.div {...fadeUp} className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Pricing</span>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
            Honest, predictable pricing.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            No per-patient fees. No setup charges. Cancel any time and take your data with you.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PRICING.map((tier, idx) => (
            <motion.div
              key={tier.name}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: idx * 0.06 }}
              className={`relative flex flex-col rounded-3xl border p-8 shadow-sm ${
                tier.highlight
                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 right-8 rounded-full bg-sky-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900">
                  Most clinics pick this
                </span>
              )}
              <h3 className="text-xl font-bold">{tier.name}</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-5xl font-black tracking-tight">{tier.price}</span>
                <span className={`text-sm font-semibold ${tier.highlight ? 'text-slate-300' : 'text-slate-500'}`}>
                  {tier.cadence}
                </span>
              </div>
              <p className={`mt-3 text-sm leading-relaxed ${tier.highlight ? 'text-slate-300' : 'text-slate-600'}`}>
                {tier.blurb}
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {tier.features.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <MaterialIcon
                      name="check_circle"
                      className={`mt-0.5 flex-shrink-0 text-[18px] ${tier.highlight ? 'text-sky-400' : 'text-emerald-500'}`}
                    />
                    <span className={tier.highlight ? 'text-slate-100' : 'text-slate-700'}>{line}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className={`mt-8 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-bold transition ${
                  tier.highlight
                    ? 'bg-white text-slate-900 hover:bg-sky-100'
                    : 'bg-slate-900 text-white hover:bg-slate-700'
                }`}
              >
                {tier.cta}
                <MaterialIcon name="arrow_forward" className="text-[18px]" />
              </a>
            </motion.div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Beta pricing · Locked in for your first 12 months
        </p>
      </div>
    </section>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-900"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-bold text-slate-900">{q}</h3>
        <MaterialIcon
          name={open ? 'remove' : 'add'}
          className={`text-[22px] text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>}
    </button>
  )
}

function Faq() {
  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <motion.div {...fadeUp}>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">FAQ</span>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
            Questions doctors ask first.
          </h2>
        </motion.div>
        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CallToAction() {
  const [email, setEmail] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorCode, setErrorCode] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    if (status === 'submitting') return
    setStatus('submitting')
    setErrorCode('')
    const result = await submitMarketingLead({
      email,
      clinicName,
      doctorName,
      source: 'landing_cta',
    })
    if (result.ok) {
      setStatus('success')
      setEmail('')
      setClinicName('')
      setDoctorName('')
    } else {
      setStatus('error')
      setErrorCode(result.error || 'SUBMIT_FAILED')
    }
  }

  return (
    <section id="cta" className="relative isolate overflow-hidden bg-slate-950 py-24 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.18),transparent_60%)]"
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:px-10">
        <motion.div {...fadeUp}>
          <h2 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
            Open your private clinic this week.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
            Public self-serve signup is opening to early-access doctors first. Leave your details and we&apos;ll send you a private onboarding link the moment your spot is ready.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Locked-in beta pricing for your first 12 months',
              'White-glove onboarding from a real human, once',
              'Private database, your branding, your patients',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <MaterialIcon name="check_circle" className="mt-0.5 flex-shrink-0 text-[18px] text-sky-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.form
          {...fadeUp}
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur"
        >
          <div>
            <label htmlFor="lead-email" className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Email
            </label>
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="doctor@clinic.com"
              className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              disabled={status === 'submitting'}
            />
          </div>
          <div>
            <label htmlFor="lead-doctor" className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Your name
            </label>
            <input
              id="lead-doctor"
              type="text"
              value={doctorName}
              onChange={(event) => setDoctorName(event.target.value)}
              placeholder="Dr. Last Name"
              className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              disabled={status === 'submitting'}
            />
          </div>
          <div>
            <label htmlFor="lead-clinic" className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Clinic name (optional)
            </label>
            <input
              id="lead-clinic"
              type="text"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              placeholder="Beirut Family Clinic"
              className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              disabled={status === 'submitting'}
            />
          </div>
          <button
            type="submit"
            disabled={status === 'submitting' || status === 'success'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {status === 'submitting' && (
              <>
                <MaterialIcon name="progress_activity" className="animate-spin text-[18px]" />
                Sending…
              </>
            )}
            {status === 'success' && (
              <>
                <MaterialIcon name="check_circle" className="text-[18px]" />
                You&apos;re on the list
              </>
            )}
            {(status === 'idle' || status === 'error') && (
              <>
                Reserve my spot
                <MaterialIcon name="arrow_forward" className="text-[18px]" />
              </>
            )}
          </button>
          {status === 'error' && (
            <p className="text-xs font-semibold text-rose-300">
              {errorCode === 'INVALID_EMAIL'
                ? 'That email does not look right — try again.'
                : errorCode === 'RATE_LIMITED'
                  ? 'A lot of requests from your network. Try again in a minute.'
                  : 'Could not reach our servers — please try again in a minute.'}
            </p>
          )}
          {status === 'success' && (
            <p className="text-xs font-semibold text-emerald-300">
              We received your details. Expect a personal email within one business day.
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400">
            By submitting, you agree to be contacted about DoctoLeb onboarding. We do not share your email and we never send patient data to a marketing list.
          </p>
        </motion.form>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-4 lg:px-10">
        <div className="md:col-span-2">
          <a href="#top" className="flex items-center gap-2.5 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-sky-400">
              <MaterialIcon name="medical_services" className="text-[20px]" />
            </span>
            <span className="text-lg font-black tracking-tight">DoctoLeb</span>
          </a>
          <p className="mt-4 max-w-md text-sm leading-relaxed">
            The modern operating system for independent doctors. Built in Lebanon, designed for clinics anywhere.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-200">Product</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a className="transition hover:text-white" href="#features">Features</a></li>
            <li><a className="transition hover:text-white" href="#pricing">Pricing</a></li>
            <li><a className="transition hover:text-white" href="#faq">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-200">Company</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a className="transition hover:text-white" href="#cta">Contact</a></li>
            <li><a className="transition hover:text-white" href="#cta">Early access</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-slate-500 lg:px-10">
          <span>© {new Date().getFullYear()} DoctoLeb. All rights reserved.</span>
          <span>Built for clinics in Lebanon and beyond.</span>
        </div>
      </div>
    </footer>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <Header />
      <main>
        <Hero />
        <TrustBand />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}

export default LandingPage
