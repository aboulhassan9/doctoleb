import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getHomeRouteForRole } from '@/lib/routes';
import { getPatientWebLoginUrl, isPatientRole } from '@/lib/appBoundaries';
import { useBrand } from '@/contexts/BrandContext';

/**
 * OpsLoginPage — Clinic Operations Portal login.
 *
 * Visually distinct from the patient login. Dense, operational, no marketing
 * flair. Staff accounts only — no signup link.
 *
 * If a patient role authenticates here, they are redirected to the patient
 * portal with a clear message.
 */
export default function OpsLoginPage() {
  const navigate = useNavigate();
  const { signIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const { displayName } = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginMode, setLoginMode] = useState('otp');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const patientWebLoginUrl = getPatientWebLoginUrl();

  const finishClinicOpsSignIn = (success, authError, user) => {
    if (!success || authError) {
      setError(authError || 'Invalid credentials');
      return;
    }

    if (user) {
      // Patient tried to log in through ops portal
      if (isPatientRole(user.role)) {
        showToast('This portal is for clinic staff. Redirecting to patient portal.', 'info');
        window.location.assign(patientWebLoginUrl);
        return;
      }

      showToast(`Welcome, ${user.first_name || 'Staff'}`, 'success');
      navigate(getHomeRouteForRole(user.role), { replace: true });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { success, error: authError, user } = await signIn(email, password);
    setLoading(false);
    finishClinicOpsSignIn(success, authError, user);
  };

  const handleOtpRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { success, error: otpError, email: verifiedEmail } = await requestEmailOtp(email);
    setLoading(false);

    if (!success || otpError) {
      setError(otpError || 'Could not send login code.');
      return;
    }

    setOtpSentTo(verifiedEmail);
    setOtpCode('');
    showToast('Login code sent.', 'success');
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { success, error: otpError, user } = await verifyEmailOtp(otpSentTo || email, otpCode);
    setLoading(false);
    finishClinicOpsSignIn(success, otpError, user);
  };

  const switchLoginMode = (mode) => {
    setLoginMode(mode);
    setError('');
    setOtpCode('');
    setOtpSentTo('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Compact top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">local_hospital</span>
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">{displayName}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Operations</span>
          </div>
        </div>
        <a
          href={patientWebLoginUrl}
          className="text-xs font-medium text-slate-400 hover:text-primary transition-colors"
        >
          Patient Portal →
        </a>
      </div>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px]"
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-slate-600 text-xl">shield_person</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized Access</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Clinic Operations Portal</h1>
            <p className="text-sm text-slate-500">
              Sign in with your staff credentials. Patient accounts should use the <a href={patientWebLoginUrl} className="text-primary hover:underline font-medium">patient portal</a>.
            </p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-5"
            >
              {error}
            </motion.div>
          )}

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => switchLoginMode('otp')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${loginMode === 'otp' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Email code
            </button>
            <button
              type="button"
              onClick={() => switchLoginMode('password')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${loginMode === 'password' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Password
            </button>
          </div>

          {loginMode === 'otp' ? (
            <form onSubmit={otpSentTo ? handleOtpVerify : handleOtpRequest} className="space-y-4">
              <div>
                <label htmlFor="ops-login-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Doctor email</label>
                <input
                  id="ops-login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinic.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                  disabled={loading || Boolean(otpSentTo)}
                  autoFocus
                />
              </div>

              {otpSentTo ? (
                <div>
                  <label htmlFor="ops-login-code" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">6-digit code</label>
                  <input
                    id="ops-login-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-center text-lg font-black tracking-[0.45em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                    disabled={loading}
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Working...
                  </>
                ) : otpSentTo ? (
                  'Verify code'
                ) : (
                  'Send login code'
                )}
              </button>

              {otpSentTo ? (
                <button
                  type="button"
                  onClick={() => {
                    setOtpSentTo('');
                    setOtpCode('');
                    setError('');
                  }}
                  className="w-full text-xs font-bold text-slate-400 hover:text-slate-700"
                  disabled={loading}
                >
                  Use another email
                </button>
              ) : null}
            </form>
          ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="ops-login-email" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Email</label>
              <input
                id="ops-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@clinic.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="ops-login-password" className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  id="ops-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-300"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  disabled={loading}
                >
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
            <Link to="/forgot-password" className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
              Forgot password?
            </Link>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="material-symbols-outlined text-xs">lock</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Encrypted Session</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
