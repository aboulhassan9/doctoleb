import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from '../services/auth';
import { resetPasswordSchema, parseWithSchema } from '../schemas';
import { getHomeRouteForRole } from '../lib/routes';

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

    setSuccess('Password updated successfully. You can continue to your dashboard.');
    const nextRole = result.data?.role;
    setTimeout(() => {
      navigate(getHomeRouteForRole(nextRole));
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8"
      >
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Set a New Password</h1>
          <p className="text-sm text-slate-500">
            Choose a strong password for your account. After saving, you will be redirected back into the app.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange('password')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Repeat your new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-xl">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
