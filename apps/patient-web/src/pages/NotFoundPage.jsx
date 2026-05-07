import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getClinicOpsLoginUrl, isClinicOpsRole } from '@/lib/appBoundaries';

/**
 * NotFoundPage — 404 catch-all page.
 *
 * Navigates the user back to their role-appropriate dashboard.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOpsUser = isClinicOpsRole(user?.role);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl text-slate-400">explore_off</span>
        </div>
        <h1 className="text-6xl font-black text-slate-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Page not found</h2>
        <p className="text-sm text-slate-500 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
          >
            Go back
          </button>
          <button
            onClick={() => {
              if (isOpsUser) {
                window.location.assign(getClinicOpsLoginUrl());
                return;
              }
              navigate(user?.role === 'patient' ? '/patient-dashboard' : '/');
            }}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-all"
          >
            {isOpsUser ? 'Open Operations Portal' : 'Go to Portal'}
          </button>
        </div>
      </div>
    </div>
  );
}
