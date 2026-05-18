import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { getHomeRouteForRole } from '@/lib/routes';
import { patientFadeRise, patientStagger } from '@ui/styles/patientMotion';

function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, icon: Icon, trailing, minLength }) {
  return (
    <div className="flex flex-col gap-4">
      <label className="patient-display text-xl font-medium text-[var(--patient-ink)] transition-colors" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--patient-muted)]" /> : null}
        <input
          id={id}
          className={`patient-field-input py-3 ${Icon ? 'pl-8' : ''} ${trailing ? 'pr-12' : ''}`}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        {trailing}
      </div>
    </div>
  );
}

function PasswordToggle({ visible, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[var(--patient-muted)] transition hover:text-[var(--patient-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--patient-sage)]"
      aria-label={label}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { displayName } = useBrand();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'Please enter your full name.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    if (!agreed) return 'Please confirm the clinic privacy and account terms before continuing.';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const { success, error: signUpError, user, pendingConfirmation, email } = await signUp(
      form.email.trim(),
      form.password,
      form.firstName.trim(),
      form.lastName.trim()
    );
    setSubmitting(false);

    if (!success) {
      setError(signUpError || 'Failed to create account. Please try again.');
      return;
    }

    if (pendingConfirmation) {
      setNotice(`Account created. Please check ${email || form.email.trim()} to confirm your email, then sign in.`);
      setForm((previous) => ({ ...previous, password: '', confirm: '' }));
      return;
    }

    navigate(user?.role === 'patient' ? '/patient-onboarding' : getHomeRouteForRole(user?.role || 'patient'));
  };

  return (
    <div className="patient-sanctuary patient-grain min-h-screen">
      <main className="patient-entry-canvas">
        <motion.section
          variants={patientStagger}
          initial="hidden"
          animate="visible"
          className="patient-entry-wide"
        >
          <motion.header variants={patientFadeRise} className="mb-16 flex flex-col gap-6 md:mb-24">
            <Fingerprint className="h-10 w-10 text-[var(--patient-sage)]" />
            <div>
              <p className="patient-kicker mb-4">{displayName}</p>
              <h1 className="patient-display mb-4 text-5xl font-normal tracking-tight text-[var(--patient-ink)]">
                Create your account
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--patient-muted)]">
                Start with your basic account details. Your first-visit clinical intake comes next, after you sign in to the secure portal.
              </p>
            </div>
          </motion.header>

          <motion.form variants={patientStagger} onSubmit={handleSubmit} className="space-y-14">
            {error ? (
              <motion.div variants={patientFadeRise} className="bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
                {error}
              </motion.div>
            ) : null}

            {notice ? (
              <motion.div variants={patientFadeRise} className="bg-[color-mix(in_srgb,var(--patient-sage)_16%,var(--patient-surface))] px-4 py-3 text-sm font-bold text-[var(--patient-sage)]" role="status">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                {notice}
              </motion.div>
            ) : null}

            <motion.div variants={patientFadeRise} className="grid gap-12 md:grid-cols-2">
              <Field id="signup-first-name" label="First name" value={form.firstName} onChange={set('firstName')} placeholder="As used by the clinic" autoComplete="given-name" icon={UserRound} />
              <Field id="signup-last-name" label="Last name" value={form.lastName} onChange={set('lastName')} placeholder="Family name" autoComplete="family-name" icon={UserRound} />
            </motion.div>

            <motion.div variants={patientFadeRise}>
              <Field id="signup-email" label="Email address" type="email" value={form.email} onChange={set('email')} placeholder="name@domain.com" autoComplete="email" icon={Mail} />
            </motion.div>

            <motion.div variants={patientFadeRise} className="grid gap-12 md:grid-cols-2">
              <Field
                id="signup-password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                minLength={8}
                icon={Lock}
                trailing={<PasswordToggle visible={showPassword} onClick={() => setShowPassword((value) => !value)} label={showPassword ? 'Hide password' : 'Show password'} />}
              />
              <Field
                id="signup-confirm-password"
                label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="Repeat your password"
                autoComplete="new-password"
                icon={Lock}
                trailing={<PasswordToggle visible={showConfirm} onClick={() => setShowConfirm((value) => !value)} label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'} />}
              />
            </motion.div>

            <motion.label variants={patientFadeRise} className="grid cursor-pointer grid-cols-[20px_1fr] gap-4 bg-[color-mix(in_srgb,var(--patient-surface)_78%,white)] px-4 py-4">
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--patient-sage)]"
              />
              <span className="text-sm font-semibold leading-7 text-[var(--patient-muted)]">
                I agree to the clinic Terms of Service and Privacy Policy, and understand that first-visit clinical intake comes next.
              </span>
            </motion.label>

            <motion.div variants={patientFadeRise} className="flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--patient-ink)_12%,transparent)] pt-12 sm:flex-row sm:items-center sm:justify-between">
              <Link to="/login" className="text-sm font-bold text-[var(--patient-muted)] underline-offset-4 hover:text-[var(--patient-sage)] hover:underline">
                Already have an account?
              </Link>
              <button
                type="submit"
                disabled={!agreed || submitting}
                className="group inline-flex items-center justify-center gap-4 bg-[var(--patient-sage)] px-8 py-5 text-xl font-medium text-white transition hover:bg-[color-mix(in_srgb,var(--patient-sage)_88%,black)] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="patient-display">{submitting ? 'Creating account...' : 'Continue to intake'}</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          </motion.form>

          <motion.p variants={patientFadeRise} initial="hidden" animate="visible" className="mt-10 flex max-w-xl items-start gap-3 text-sm font-semibold leading-7 text-[var(--patient-muted)]">
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--patient-clay)]" />
            PHI starts only after protected sign-in. The public account step stays deliberately small.
          </motion.p>
        </motion.section>
      </main>
    </div>
  );
}
