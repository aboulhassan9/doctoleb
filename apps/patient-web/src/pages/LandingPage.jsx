import React from 'react';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

const features = [
  ['Patient access', 'Online booking, intake, consent, records, and messaging under your clinic brand.'],
  ['Clinic operations', 'Doctor, secretary, and pre-doctor workflows stay permissioned and separate from patients.'],
  ['SaaS control', 'Plans, branding, domains, feature flags, provisioning, and audit events from one console.'],
  ['Ready for growth', 'AI, BI, custom domains, and advanced reports can be switched on by subscription.'],
];

const workflow = [
  'Launch a clinic workspace',
  'Invite the doctor and staff',
  'Turn on the right features',
  'Route patients to the branded portal',
];

function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f3f1ea] text-[#101b18]">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-[#101b18]/10 bg-[#f3f1ea]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="/" className="text-lg font-black tracking-tight">DoctoLeb</a>
          <nav className="hidden items-center gap-8 text-sm font-bold text-[#42504b] md:flex">
            <a href="#platform" className="transition hover:text-[#101b18]">Platform</a>
            <a href="#features" className="transition hover:text-[#101b18]">Features</a>
            <a href="#early-access" className="transition hover:text-[#101b18]">Early access</a>
          </nav>
          <a
            href="#early-access"
            className="rounded-full bg-[#101b18] px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-[#101b18]/15 transition hover:-translate-y-0.5"
          >
            Book a demo
          </a>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen px-5 pt-32">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(8,145,178,0.2),transparent_33%),radial-gradient(circle_at_20%_70%,rgba(180,83,9,0.14),transparent_30%)]" />
          <div className="absolute right-[-16rem] top-28 h-[38rem] w-[38rem] rounded-full border border-[#101b18]/10" />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-3xl">
              <p className="mb-6 text-sm font-black uppercase tracking-[0.35em] text-[#06758c]">
                Clinic SaaS for doctors
              </p>
              <h1 className="text-6xl font-black leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-8xl">
                Run the digital side of your clinic without duct tape.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#42504b]">
                DoctoLeb gives doctors a branded patient portal, a focused clinic-ops workspace,
                and a SaaS control layer that can grow from one pilot clinic to many tenants.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#early-access"
                  className="rounded-full bg-[#101b18] px-7 py-4 text-center text-sm font-black text-white shadow-xl shadow-[#101b18]/20 transition hover:-translate-y-1"
                >
                  Join early access
                </a>
                <a
                  href="#platform"
                  className="rounded-full border border-[#101b18]/15 bg-white/60 px-7 py-4 text-center text-sm font-black text-[#101b18] transition hover:-translate-y-1 hover:bg-white"
                >
                  See the platform
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
              className="relative"
            >
              <div className="rounded-[2.25rem] bg-[#101b18] p-4 shadow-2xl shadow-[#101b18]/25">
                <div className="rounded-[1.75rem] bg-[#e8f7f4] p-6">
                  <div className="mb-10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#06758c]">Live tenant</p>
                      <p className="mt-1 text-2xl font-black">Dr. Hassan Clinic</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">active</span>
                  </div>
                  <div className="grid gap-4">
                    {workflow.map((item, index) => (
                      <motion.div
                        key={item}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 + index * 0.12 }}
                        className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 rounded-3xl bg-white p-4 shadow-sm"
                      >
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#101b18] text-sm font-black text-white">
                          {index + 1}
                        </span>
                        <span className="font-black">{item}</span>
                        <span className="text-sm font-bold text-[#06758c]">ready</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 -left-6 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-[#101b18]/10">
                <p className="text-3xl font-black">0 PHI</p>
                <p className="mt-1 text-sm font-bold text-[#42504b]">in the SaaS control plane</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="platform" className="px-5 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#06758c]">One product, three surfaces</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.04em]">Built for how clinics actually operate.</h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {[
                ['For doctors', 'A clinic operations app for schedules, patients, messages, staff, medical records, billing, reports, and settings.'],
                ['For patients', 'A branded portal for appointment requests, intake, consent, documents, and follow-up communication.'],
                ['For DoctoLeb', 'A super-admin console for tenants, plans, features, domains, provisioning, observability, and audit.'],
              ].map(([title, text]) => (
                <motion.article
                  key={title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  className="rounded-[2rem] bg-white/70 p-7 shadow-sm ring-1 ring-[#101b18]/10"
                >
                  <h3 className="text-2xl font-black">{title}</h3>
                  <p className="mt-4 leading-7 text-[#42504b]">{text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#101b18] px-5 py-24 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-300">Subscription-ready</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.04em]">Features turn on by plan, not by code forks.</h2>
              <p className="mt-6 leading-8 text-slate-300">
                Messaging, branding, custom domains, staff seats, AI summaries, BI dashboards,
                and reports are modeled as entitlements so each doctor gets exactly what they subscribe to.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(([title, text]) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-[2rem] bg-white/8 p-6 ring-1 ring-white/10"
                >
                  <h3 className="text-xl font-black">{title}</h3>
                  <p className="mt-3 leading-7 text-slate-300">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="early-access" className="px-5 py-24">
          <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-white p-8 text-center shadow-xl shadow-[#101b18]/10 ring-1 ring-[#101b18]/10 sm:p-14">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#06758c]">Private pilot</p>
            <h2 className="mt-4 text-5xl font-black tracking-[-0.04em]">For doctors who want the clinic app before everyone else.</h2>
            <p className="mx-auto mt-5 max-w-2xl leading-8 text-[#42504b]">
              We are preparing the SaaS foundation before public domain launch. The product is designed
              so domain activation, billing, and future AI/BI packages can be layered in safely.
            </p>
            <a
              href="mailto:hello@doctoleb.example?subject=DoctoLeb%20doctor%20pilot"
              className="mt-8 inline-flex rounded-full bg-[#101b18] px-8 py-4 text-sm font-black text-white shadow-xl shadow-[#101b18]/20 transition hover:-translate-y-1"
            >
              Request pilot access
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
