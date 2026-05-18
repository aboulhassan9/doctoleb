import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
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
    <div className="patient-sanctuary patient-grain flex min-h-screen items-center justify-center px-6">
      <div className="patient-paper-strong patient-surface max-w-md p-8 text-center">
        <div className="patient-icon-muted mx-auto mb-6 h-20 w-20">
          <Compass className="h-9 w-9" aria-hidden="true" />
        </div>
        <h1 className="patient-display mb-2 text-6xl font-medium text-[var(--patient-ink)]">404</h1>
        <h2 className="mb-2 text-xl font-semibold text-[var(--patient-ink)]">Page not found</h2>
        <p className="mb-8 text-sm text-[var(--patient-muted)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="patient-button-secondary px-6 py-2.5"
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
            className="patient-button-primary px-6 py-2.5"
          >
            {isOpsUser ? 'Open Operations Portal' : 'Go to Portal'}
          </button>
        </div>
      </div>
    </div>
  );
}
