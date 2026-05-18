import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { authService } from '@core/services/auth';
import { useBrand } from '@ui/contexts/BrandContext';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

export default function ForgotPasswordPage() {
  const { displayName } = useBrand();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSendReset = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await authService.requestPasswordReset(trimmedEmail);
    setSubmitting(false);

    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  };

  return (
    <div className="patient-sanctuary patient-grain min-h-screen">
      <main className="patient-entry-canvas">
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="patient-entry-main flex flex-col gap-12"
        >
          <motion.div variants={patientFadeRise}>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--patient-sage)] underline-offset-4 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </motion.div>

          <motion.header variants={patientFadeRise} className="flex flex-col items-start gap-4">
            <p className="patient-kicker">{displayName}</p>
            <h1 className="patient-display text-5xl font-normal tracking-tight text-[var(--patient-sage)]">
              Reset your password
            </h1>
            <p className="max-w-lg text-lg leading-8 text-[var(--patient-muted)]">
              Enter the email used for your patient account. If the clinic has that account, we will send a password reset link.
            </p>
          </motion.header>

          <motion.form variants={patientFadeRise} onSubmit={handleSendReset} className="patient-entry-panel flex flex-col gap-8">
            {error ? (
              <div role="alert" className="flex items-start gap-3 text-red-700">
                <span className="mt-0.5 text-lg leading-none">!</span>
                <p className="text-sm italic leading-6">{error}</p>
              </div>
            ) : null}

            {sent ? (
              <div className="flex flex-col gap-5" role="status">
                <CheckCircle2 className="h-7 w-7 text-[var(--patient-sage)]" />
                <div>
                  <h2 className="patient-display text-3xl font-medium tracking-tight text-[var(--patient-ink)]">
                    Check your inbox.
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--patient-muted)]">
                    A reset link was sent to <span className="font-black text-[var(--patient-ink)]">{email}</span>. Check spam if you do not see it soon.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setEmail('');
                  }}
                  className="self-start rounded-full bg-[color-mix(in_srgb,var(--patient-sage)_14%,var(--patient-surface))] px-6 py-3 text-sm font-medium text-[var(--patient-sage)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_20%,var(--patient-surface))]"
                >
                  Send to another email
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="patient-reset-email" className="text-sm font-medium tracking-[0.01em] text-[var(--patient-muted)]">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" />
                    <input
                      id="patient-reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@domain.com"
                      disabled={submitting}
                      className="patient-field-input py-3 pl-8 disabled:opacity-60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="group self-start inline-flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--patient-sage)_14%,var(--patient-surface))] px-6 py-3 text-sm font-medium text-[var(--patient-sage)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_20%,var(--patient-surface))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{submitting ? 'Sending...' : 'Send reset link'}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </>
            )}
          </motion.form>

          <motion.section variants={patientFadeRise} className="patient-entry-vault">
            <p className="flex items-start gap-3 text-sm font-semibold leading-7 text-[var(--patient-muted)]">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--patient-clay)]" />
              For privacy, we do not reveal whether an email exists beyond the normal reset flow.
            </p>
          </motion.section>
        </motion.section>
      </main>
    </div>
  );
}
