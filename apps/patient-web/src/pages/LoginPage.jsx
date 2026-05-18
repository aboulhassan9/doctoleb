import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Fingerprint, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import { getHomeRouteForRole } from '@core/lib/routes';
import { getClinicOpsLoginUrl, isClinicOpsRole } from '@core/lib/appBoundaries';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, logout } = useAuth();
  const { showToast } = useToast();
  const { displayName } = useBrand();
  const clinicOpsLoginUrl = getClinicOpsLoginUrl();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { success, error: authError, user } = await signIn(email, password);
    setLoading(false);

    if (!success || authError) {
      setError(authError || 'Invalid email or password');
      return;
    }

    if (user && isClinicOpsRole(user.role)) {
      showToast('Staff accounts belong in the Operations Portal.', 'info');
      await logout();
      window.location.assign(clinicOpsLoginUrl);
      return;
    }

    if (user) {
      showToast(`Welcome, ${user.first_name}!`, 'success');
      navigate(getHomeRouteForRole(user.role));
    }
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
          <motion.header variants={patientFadeRise} className="flex flex-col items-start gap-4">
            <h1 className="patient-display text-5xl font-normal italic tracking-tight text-[var(--patient-sage)]">
              {displayName}
            </h1>
            <p className="max-w-sm text-lg leading-8 text-[var(--patient-muted)]">
              Sign in to view your appointments, records, messages, and billing.
            </p>
          </motion.header>

          <motion.form
            variants={patientFadeRise}
            onSubmit={handleSubmit}
            className="patient-entry-panel flex flex-col gap-8"
            aria-labelledby="patient-login-title"
          >
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium tracking-[0.01em] text-[var(--patient-muted)]" htmlFor="patient-login-email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" />
                <input
                  className="patient-field-input py-3 pl-8"
                  id="patient-login-email"
                  placeholder="e.g. name@domain.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium tracking-[0.01em] text-[var(--patient-muted)]" htmlFor="patient-login-password">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-bold text-[var(--patient-sage)] underline-offset-4 hover:underline">
                  Reset access
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" />
                <input
                  className="patient-field-input py-3 pl-8 pr-12"
                  id="patient-login-password"
                  placeholder="Your password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--patient-muted)] transition hover:text-[var(--patient-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--patient-sage)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-3 text-red-700" role="alert">
                <span className="mt-0.5 text-lg leading-none">!</span>
                <p className="text-sm italic leading-6">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="group self-start inline-flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--patient-sage)_14%,var(--patient-surface))] px-6 py-3 text-sm font-medium text-[var(--patient-sage)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_20%,var(--patient-surface))] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="relative flex items-center py-2">
              <div className="h-px flex-grow bg-[color-mix(in_srgb,var(--patient-ink)_12%,transparent)]" />
              <span className="mx-4 shrink-0 text-sm font-medium text-[color-mix(in_srgb,var(--patient-muted)_55%,transparent)]">
                or
              </span>
              <div className="h-px flex-grow bg-[color-mix(in_srgb,var(--patient-ink)_12%,transparent)]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-3 bg-transparent py-4 text-sm font-medium text-[var(--patient-ink)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_8%,transparent)]"
              >
                <Fingerprint className="h-4 w-4" />
                Create account
              </Link>
              <a
                href={clinicOpsLoginUrl}
                className="inline-flex items-center justify-center gap-3 bg-transparent py-4 text-sm font-medium text-[var(--patient-muted)] transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_8%,transparent)] hover:text-[var(--patient-ink)]"
              >
                <ShieldCheck className="h-4 w-4" />
                Staff portal
              </a>
            </div>
          </motion.form>

          <motion.section variants={patientFadeRise} className="patient-entry-vault flex flex-col gap-4">
            <h2 className="patient-display text-3xl font-medium text-[var(--patient-clay)]">Your records stay private</h2>
            <p className="text-base leading-7 text-[var(--patient-muted)]">
              Your account is protected by clinic authentication. Appointments, records, messages, and billing are
              visible only to you after you sign in.
            </p>
          </motion.section>
        </motion.section>
      </main>
    </div>
  );
}
