import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute, { AuthRedirect } from '@ui/components/ProtectedRoute';
import { CLINIC_OPS_ROLES, APP_SURFACES } from '@/lib/appBoundaries';
import { ToastProvider } from '@ui/contexts/ToastContext';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { SidebarProvider } from '@ui/contexts/SidebarContext';
import { AuthProvider } from '@ui/contexts/AuthContext';
import { BrandProvider } from '@ui/contexts/BrandContext';
import { TenantBootstrap } from '@ui/contexts/TenantBootstrap';
import { PatientConsentGate } from '@ui/components/consent/PatientConsentGate';
import ErrorBoundary from '@ui/components/ErrorBoundary';
import { LoadingSkeleton } from '@ui/components/ui';

// ──────────────────────────────────────────────
// DoctoLeb Monorepo — Root router (dev mode)
//
// In production, patient-web and clinic-ops each
// have their own App.jsx with only their routes.
// This file is the UNIFIED dev-mode router.
// ──────────────────────────────────────────────

// Patient-Web pages
const LandingPage = lazy(() => import('@patient-web/pages/LandingPage'));
const LoginPage = lazy(() => import('@patient-web/pages/LoginPage'));
const SignUpPage = lazy(() => import('@patient-web/pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('@patient-web/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@patient-web/pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('@patient-web/pages/NotFoundPage'));

const PatientOwnProfilePage = lazy(() => import('@patient-web/pages/PatientOwnProfilePage'));
const PatientAppointmentsPage = lazy(() => import('@patient-web/pages/PatientAppointmentsPage'));
const PatientMedicalHistoryPage = lazy(() => import('@patient-web/pages/PatientMedicalHistoryPage'));
const PatientDashboardPage = lazy(() => import('@patient-web/pages/PatientDashboardPage'));
const PatientMessagesPage = lazy(() => import('@patient-web/pages/PatientMessagesPage'));

// Clinic-Ops: Login
const OpsLoginPage = lazy(() => import('@clinic-ops/pages/OpsLoginPage'));

// Clinic-Ops: Secretary
const DashboardPage = lazy(() => import('@clinic-ops/pages/DashboardPage'));
const PatientsPage = lazy(() => import('@clinic-ops/pages/PatientsPage'));
const AppointmentsPage = lazy(() => import('@clinic-ops/pages/AppointmentsPage'));
const BillingPage = lazy(() => import('@clinic-ops/pages/BillingPage'));
const CreateBillPage = lazy(() => import('@clinic-ops/pages/CreateBillPage'));
const SecretarySlotsPage = lazy(() => import('@clinic-ops/pages/SecretarySlotsPage'));
const SecretaryBookingPage = lazy(() => import('@clinic-ops/pages/SecretaryBookingPage'));

// Clinic-Ops: Pre-doctor
const PreDoctorDashboardPage = lazy(() => import('@clinic-ops/pages/PreDoctorDashboardPage'));
const PreDoctorPatientsPage = lazy(() => import('@clinic-ops/pages/PreDoctorPatientsPage'));
const PreDoctorAppointmentsPage = lazy(() => import('@clinic-ops/pages/PreDoctorAppointmentsPage'));
const PreDoctorCheckPage = lazy(() => import('@clinic-ops/pages/PreDoctorCheckPage'));
const PreDoctorNotificationsPage = lazy(() => import('@clinic-ops/pages/PreDoctorNotificationsPage'));
const PreDoctorSuccessPage = lazy(() => import('@clinic-ops/pages/PreDoctorSuccessPage'));
const PreDoctorSchedulePage = lazy(() => import('@clinic-ops/pages/PreDoctorSchedulePage'));
const PatientProfilePage = lazy(() => import('@clinic-ops/pages/PatientProfilePage'));

// Clinic-Ops: Doctor
const DoctorDashboardPage = lazy(() => import('@clinic-ops/pages/DoctorDashboardPage'));
const DoctorPatientsPage = lazy(() => import('@clinic-ops/pages/DoctorPatientsPage'));
const DoctorAppointmentsPage = lazy(() => import('@clinic-ops/pages/DoctorAppointmentsPage'));
const DoctorLabRequestPage = lazy(() => import('@clinic-ops/pages/DoctorLabRequestPage'));
const DoctorPatientProfilePage = lazy(() => import('@clinic-ops/pages/DoctorPatientProfilePage'));
const DoctorMedicalHistoryPage = lazy(() => import('@clinic-ops/pages/DoctorMedicalHistoryPage'));
const DoctorReportsPage = lazy(() => import('@clinic-ops/pages/DoctorReportsPage'));
const DoctorReferralsPage = lazy(() => import('@clinic-ops/pages/DoctorReferralsPage'));
const DoctorCertificatesPage = lazy(() => import('@clinic-ops/pages/DoctorCertificatesPage'));
const DoctorEncounterPage = lazy(() => import('@clinic-ops/pages/DoctorEncounterPage'));
const StaffMessagesPage = lazy(() => import('@clinic-ops/pages/StaffMessagesPage'));

function App() {
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

                    {/* ── Public / Patient-Web ── */}
                    <Route path="/" element={<AuthRedirect intendedSurface={APP_SURFACES.patientWeb}><LandingPage /></AuthRedirect>} />
                    <Route path="/marketing" element={<AuthRedirect intendedSurface={APP_SURFACES.patientWeb}><LandingPage /></AuthRedirect>} />

                    {/* Auth pages */}
                    <Route path="/login" element={<AuthRedirect intendedSurface={APP_SURFACES.patientWeb} redirectAll><LoginPage /></AuthRedirect>} />
                    <Route path="/signup" element={<AuthRedirect intendedSurface={APP_SURFACES.patientWeb} redirectAll><SignUpPage /></AuthRedirect>} />
                    <Route path="/ops/login" element={<AuthRedirect intendedSurface={APP_SURFACES.clinicOps} redirectAll><OpsLoginPage /></AuthRedirect>} />

                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* ── Secretary (clinic-ops) ── */}
                    <Route path="/dashboard" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><DashboardPage /></ProtectedRoute>} />
                    <Route path="/patients" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><PatientsPage /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><AppointmentsPage /></ProtectedRoute>} />
                    <Route path="/billing" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><BillingPage /></ProtectedRoute>} />
                    <Route path="/billing/new" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><CreateBillPage /></ProtectedRoute>} />
                    <Route path="/secretary-slots" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretarySlotsPage /></ProtectedRoute>} />
                    <Route path="/secretary-booking" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretaryBookingPage /></ProtectedRoute>} />

                    {/* ── Pre-doctor (clinic-ops) ── */}
                    <Route path="/predoctor-dashboard" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorDashboardPage /></ProtectedRoute>} />
                    <Route path="/predoctor-patients" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorPatientsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-appointments" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-new-check" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorCheckPage /></ProtectedRoute>} />
                    <Route path="/predoctor-notifications" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorNotificationsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-success" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorSuccessPage /></ProtectedRoute>} />
                    <Route path="/predoctor-schedule" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorSchedulePage /></ProtectedRoute>} />
                    <Route path="/patient-profile/:id" element={<ProtectedRoute allowedRoles={['doctor', 'predoctor', 'secretary']} appSurface={APP_SURFACES.clinicOps}><PatientProfilePage /></ProtectedRoute>} />

                    {/* ── Patient (patient-web) ── */}
                    <Route path="/patient-profile" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientOwnProfilePage /></ProtectedRoute>} />
                    <Route path="/patient-appointments" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/patient-dashboard" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientDashboardPage /></ProtectedRoute>} />
                    <Route path="/patient-history" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientMedicalHistoryPage /></ProtectedRoute>} />
                    <Route path="/patient-messages" element={<ProtectedRoute requiredRole="patient" appSurface={APP_SURFACES.patientWeb}><PatientMessagesPage /></ProtectedRoute>} />

                    {/* ── Doctor (clinic-ops) ── */}
                    <Route path="/doctor-dashboard" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorDashboardPage /></ProtectedRoute>} />
                    <Route path="/doctor-patients" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorPatientsPage /></ProtectedRoute>} />
                    <Route path="/doctor-appointments" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/doctor-lab-request" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorLabRequestPage /></ProtectedRoute>} />
                    <Route path="/doctor-patient/:id" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorPatientProfilePage /></ProtectedRoute>} />
                    <Route path="/doctor-patient-history/:id" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorMedicalHistoryPage /></ProtectedRoute>} />
                    <Route path="/doctor-reports" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorReportsPage /></ProtectedRoute>} />
                    <Route path="/doctor-referrals" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorReferralsPage /></ProtectedRoute>} />
                    <Route path="/doctor-certificates" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorCertificatesPage /></ProtectedRoute>} />
                    <Route path="/doctor-encounter/:appointmentId" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorEncounterPage /></ProtectedRoute>} />
                    <Route path="/doctor-encounter-id/:encounterId" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorEncounterPage /></ProtectedRoute>} />

                    {/* Shared messaging — accessible to all clinic-ops staff */}
                    <Route path="/staff-messages" element={<ProtectedRoute allowedRoles={CLINIC_OPS_ROLES} appSurface={APP_SURFACES.clinicOps}><StaffMessagesPage /></ProtectedRoute>} />

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

export default App;
