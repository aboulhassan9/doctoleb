import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute, { AuthRedirect } from '@ui/components/ProtectedRoute';
import FeatureProtectedRoute from '@ui/components/FeatureProtectedRoute';
import { ENTITLEMENT_FEATURES } from '@core/lib/entitlements';
import { ToastProvider } from '@ui/contexts/ToastContext';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { SidebarProvider } from '@ui/contexts/SidebarContext';
import { AuthProvider } from '@ui/contexts/AuthContext';
import { BrandProvider } from '@ui/contexts/BrandContext';
import { TenantBootstrap } from '@ui/contexts/TenantBootstrap';
import { PatientConsentGate } from '@ui/components/consent/PatientConsentGate';
import { APP_SURFACES } from '@/lib/appBoundaries';
import ErrorBoundary from '@ui/components/ErrorBoundary';
import { LoadingSkeleton } from '@ui/components/ui';

// ──────────────────────────────────────────────
// Patient-Web — standalone router
// Only contains public + patient routes.
// Staff/clinic routes are in apps/clinic-ops.
// ──────────────────────────────────────────────

// Public pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Patient portal
const PatientOwnProfilePage = lazy(() => import('./pages/PatientOwnProfilePage'));
const PatientAppointmentsPage = lazy(() => import('./pages/PatientAppointmentsPage'));
const PatientMedicalHistoryPage = lazy(() => import('./pages/PatientMedicalHistoryPage'));
const PatientDashboardPage = lazy(() => import('./pages/PatientDashboardPage'));
const PatientMessagesPage = lazy(() => import('./pages/PatientMessagesPage'));

function TenantPortalShell() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <TenantBootstrap appSurface={APP_SURFACES.patientWeb}>
          <AuthProvider>
            <BrandProvider appSurface={APP_SURFACES.patientWeb}>
              <PatientConsentGate>
              <ErrorBoundary>
                <Router>
                  <Suspense fallback={<LoadingSkeleton rows={8} />}>
                    <Routes>
                      {/* Public */}
                      <Route path="/" element={<AuthRedirect intendedSurface="patient-web"><LandingPage /></AuthRedirect>} />
                      <Route path="/marketing" element={<AuthRedirect intendedSurface="patient-web"><LandingPage /></AuthRedirect>} />

                      {/* Auth */}
                      <Route path="/login" element={<AuthRedirect intendedSurface="patient-web" redirectAll><LoginPage /></AuthRedirect>} />
                      <Route path="/signup" element={<AuthRedirect intendedSurface="patient-web" redirectAll><SignUpPage /></AuthRedirect>} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />

                      {/* Patient Portal */}
                      <Route path="/patient-profile" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientOwnProfilePage /></ProtectedRoute>} />
                      <Route path="/patient-appointments" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientAppointmentsPage /></ProtectedRoute>} />
                      <Route path="/patient-dashboard" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientDashboardPage /></ProtectedRoute>} />
                      <Route path="/patient-history" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientMedicalHistoryPage /></ProtectedRoute>} />
                      <Route path="/patient-messages" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.messaging} audience="patient"><PatientMessagesPage /></FeatureProtectedRoute></ProtectedRoute>} />

                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </Router>
              </ErrorBoundary>
              </PatientConsentGate>
            </BrandProvider>
          </AuthProvider>
          </TenantBootstrap>
        </ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

function App() {
  return <TenantPortalShell />;
}

export default App;
