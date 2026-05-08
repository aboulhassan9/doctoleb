import { useState } from 'react';
import { motion } from 'framer-motion';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { Field, TextInput, PrimaryButton } from './ui';

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
    <main className="min-h-screen bg-[#071317] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden p-8 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.28),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(8,145,178,0.2),transparent_30%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="text-sm font-black uppercase tracking-[0.35em] text-cyan-200">DoctoLeb Console</div>
            <div className="max-w-2xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl font-black leading-[0.95] sm:text-7xl"
              >
                SaaS control without clinical data.
              </motion.h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Manage tenants, pending domains, plans, entitlements, branding sync, and provisioning
                checklists from the zero-PHI control plane.
              </p>
            </div>
            <p className="text-sm text-slate-400">Designed for `console.doctoleb.com` once the domain is owned.</p>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 p-6 text-slate-950">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl shadow-slate-950/10">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-700">Super admin</p>
            <h2 className="mt-3 text-3xl font-black">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">Uses control-plane Supabase Auth and `super_admins` RBAC.</p>
            <div className="mt-8 grid gap-4">
              <Field label="Email">
                <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </Field>
              <Field label="Password">
                <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </Field>
            </div>
            {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <PrimaryButton disabled={submitting} className="mt-6 w-full">
              {submitting ? 'Signing in...' : 'Open console'}
            </PrimaryButton>
          </form>
        </section>
      </div>
    </main>
  );
}
