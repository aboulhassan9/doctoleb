import { useState } from 'react';
import { motion } from 'framer-motion';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Field, TextInput, PrimaryButton } from './ui';
import BrandLockup from './BrandLockup';

export default function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await controlPlaneApi.signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSignedIn(result.data);
    } catch (_error) {
      setError('Unable to sign in right now. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen text-slate-900">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.2fr_0.8fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-16 text-slate-100 lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="relative z-10 flex h-full flex-col justify-between"
          >
            <motion.div variants={staggerItem}>
              <BrandLockup />
            </motion.div>

            <motion.div variants={staggerItem} className="max-w-xl">
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
                SaaS Control Plane.
                <br />
                <span className="text-slate-500">Zero-PHI Operations.</span>
              </h1>

              <div className="mt-8 space-y-6 text-sm text-slate-400">
                <p className="leading-relaxed">
                  Manage tenants, pending domains, branding configurations, and provisioning checklists safely. This
                  interface operates exclusively on control-plane metadata, strictly segregated from clinical databases.
                </p>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-6">
                  <div>
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-white">Security</div>
                    <div className="mt-1 text-xs text-slate-500">MFA &amp; role-based access control</div>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] font-semibold uppercase tracking-wide text-white">Compliance</div>
                    <div className="mt-1 text-xs text-slate-500">Strict zero-PHI audit logging</div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="font-mono text-xs text-slate-600">
              console.doctoleb.com &middot; v3.0.0
            </motion.div>
          </motion.div>
        </section>

        <section className="flex items-center justify-center bg-[#faf8f4] p-8 sm:p-12 md:p-16">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex w-full max-w-sm flex-col gap-8"
          >
            <motion.div variants={staggerItem} className="flex flex-col gap-5">
              <div className="lg:hidden">
                <BrandLockup tone="light" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
                <p className="text-sm text-slate-500">
                  Sign in with your control-plane credentials to access administration utilities.
                </p>
              </div>
            </motion.div>

            <motion.form variants={staggerItem} onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Field label="Administrator email">
                <TextInput
                  type="email"
                  placeholder="admin@doctoleb.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>

              <Field label="Password">
                <TextInput
                  type="password"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <PrimaryButton disabled={submitting} className="mt-1 h-11 w-full">
                {submitting ? 'Authenticating...' : 'Sign In to Console'}
              </PrimaryButton>
            </motion.form>

            <motion.p
              variants={staggerItem}
              className="border-t border-slate-200 pt-5 text-center text-xs leading-relaxed text-slate-400"
            >
              Only authorized staff are permitted to access this panel. All attempts are monitored and logged.
            </motion.p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
