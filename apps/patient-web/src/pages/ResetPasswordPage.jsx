import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { authService } from '@core/services/auth';
import { resetPasswordSchema, parseWithSchema } from '@core/schemas';
import { getHomeRouteForRole } from '@core/lib/routes';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const { data, error: validationError } = parseWithSchema(resetPasswordSchema, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const result = await authService.resetPassword(data.password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Password updated successfully. Redirecting you back into the patient portal.');
    const nextRole = result.data?.role;
    setTimeout(() => {
      navigate(getHomeRouteForRole(nextRole));
    }, 1200);
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
            <p className="patient-kicker">Secure reset</p>
            <h1 className="patient-display text-5xl font-normal tracking-tight text-[var(--patient-sage)]">
              Set a new password
            </h1>
            <p className="max-w-lg text-lg leading-8 text-[var(--patient-muted)]">
              Your password unlocks only your patient portal session. Keep it unique to this clinic account.
            </p>
          </motion.header>

          <motion.form variants={patientFadeRise} onSubmit={handleSubmit} className="patient-entry-panel flex flex-col gap-8">
            {error ? (
              <div role="alert" className="flex items-start gap-3 text-red-700">
                <span className="mt-0.5 text-lg leading-none">!</span>
                <p className="text-sm italic leading-6">{error}</p>
              </div>
            ) : null}

            {success ? (
              <div role="status" className="flex items-start gap-3 text-[var(--patient-sage)]">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <p className="text-sm font-bold leading-6">{success}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label htmlFor="patient-new-password" className="text-sm font-medium tracking-[0.01em] text-[var(--patient-muted)]">
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" />
                <input
                  id="patient-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="At least 8 characters"
                  className="patient-field-input py-3 pl-8 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--patient-muted)] transition hover:text-[var(--patient-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--patient-sage)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="patient-confirm-password" className="text-sm font-medium tracking-[0.01em] text-[var(--patient-muted)]">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" />
                <input
                  id="patient-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="Repeat your new password"
                  className="patient-field-input py-3 pl-8 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--patient-muted)] transition hover:text-[var(--patient-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--patient-sage)]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="group self-start inline-flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--patient-sage)_14%,var(--patient-surface))] px-6 py-3 text-sm font-medium text-[var(--patient-sage)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_20%,var(--patient-surface))] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{submitting ? 'Updating...' : 'Update password'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.form>

          <motion.section variants={patientFadeRise} className="patient-entry-vault">
            <p className="flex items-start gap-3 text-sm font-semibold leading-7 text-[var(--patient-muted)]">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--patient-clay)]" />
              After saving, your session returns to the correct role home.
            </p>
          </motion.section>
        </motion.section>
      </main>
    </div>
  );
}
