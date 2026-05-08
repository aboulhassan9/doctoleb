import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeRouteForRole, OPS_LOGIN_PATH, PATIENT_LOGIN_PATH } from '@/lib/routes';
import {
  getClinicOpsLoginUrl,
  getPatientWebLoginUrl,
  isPatientRole,
  isClinicOpsRole,
} from '@/lib/appBoundaries';

function LoadingRedirect({ message = 'Redirecting...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  );
}

function ExternalRedirect({ to }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.assign(to);
    }
  }, [to]);

  return <LoadingRedirect message="Opening the correct portal..." />;
}

/**
 * ProtectedRoute — Auth + role + app-surface guard.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.requiredRole] - Exact role match guard.
 * @param {string[]} [props.allowedRoles] - Multi-role guard for shared staff screens.
 * @param {'patient-web'|'clinic-ops'} [props.appSurface] - App-boundary guard.
 *   If 'patient-web', only patient roles pass.
 *   If 'clinic-ops', only staff/admin roles pass.
 *   Mismatches redirect to the correct home route.
 */
export default function ProtectedRoute({ children, requiredRole = null, allowedRoles = null, appSurface = null }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingRedirect message="Loading..." />;
  }

  if (!user) {
    // Unauthenticated: redirect to the appropriate login for the surface
    if (appSurface === 'clinic-ops') {
      return <Navigate to={OPS_LOGIN_PATH} replace />;
    }
    return <Navigate to={PATIENT_LOGIN_PATH} replace />;
  }

  // App-surface guard: wrong surface → redirect to correct home
  if (appSurface === 'patient-web' && isClinicOpsRole(user.role)) {
    return <ExternalRedirect to={getClinicOpsLoginUrl()} />;
  }
  if (appSurface === 'clinic-ops' && isPatientRole(user.role)) {
    return <ExternalRedirect to={getPatientWebLoginUrl()} />;
  }

  const acceptedRoles = allowedRoles || (requiredRole ? [requiredRole] : null);

  // Per-role guard (existing behavior, with optional multi-role support)
  if (acceptedRoles && !acceptedRoles.includes(user.role)) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return children;
}

/**
 * AuthRedirect — Controls access to public/login pages for authenticated users.
 *
 * Two modes via `redirectAll`:
 *   - `true` (login/signup): ALL authenticated users → their dashboard.
 *   - `false` (landing/marketing): only wrong-surface users are redirected.
 *     Patients can still browse the landing page. Staff on patient-web → ops dashboard.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {'patient-web'|'clinic-ops'} [props.intendedSurface] - Which app surface this page belongs to.
 * @param {boolean} [props.redirectAll=false] - If true, redirect ALL authenticated users (use on login/signup).
 */
export function AuthRedirect({ children, intendedSurface = null, redirectAll = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingRedirect message="Loading..." />;
  }

  if (!user) {
    return children;
  }

  // Login/signup pages: always redirect authenticated users to their dashboard
  if (redirectAll) {
    if (intendedSurface === 'patient-web' && isClinicOpsRole(user.role)) {
      return <ExternalRedirect to={getClinicOpsLoginUrl()} />;
    }
    if (intendedSurface === 'clinic-ops' && isPatientRole(user.role)) {
      return <ExternalRedirect to={getPatientWebLoginUrl()} />;
    }
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  // Content pages: only redirect users from the wrong app surface
  if (intendedSurface === 'patient-web' && isClinicOpsRole(user.role)) {
    return <ExternalRedirect to={getClinicOpsLoginUrl()} />;
  }
  if (intendedSurface === 'clinic-ops' && isPatientRole(user.role)) {
    return <ExternalRedirect to={getPatientWebLoginUrl()} />;
  }

  // Right surface or no surface specified — show the page
  return children;
}
