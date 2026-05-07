import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { AuthProvider } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandContext';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/ui';

// ──────────────────────────────────────────────
// Route-level code splitting via React.lazy()
// Each page becomes its own chunk, loaded on demand.
// ──────────────────────────────────────────────

// Public pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Secretary pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const CreateBillPage = lazy(() => import('./pages/CreateBillPage'));
const SecretarySlotsPage = lazy(() => import('./pages/SecretarySlotsPage'));
const SecretaryBookingPage = lazy(() => import('./pages/SecretaryBookingPage'));

// Pre-doctor pages
const PreDoctorDashboardPage = lazy(() => import('./pages/PreDoctorDashboardPage'));
const PreDoctorPatientsPage = lazy(() => import('./pages/PreDoctorPatientsPage'));
const PreDoctorAppointmentsPage = lazy(() => import('./pages/PreDoctorAppointmentsPage'));
const PreDoctorCheckPage = lazy(() => import('./pages/PreDoctorCheckPage'));
const PreDoctorNotificationsPage = lazy(() => import('./pages/PreDoctorNotificationsPage'));
const PreDoctorSuccessPage = lazy(() => import('./pages/PreDoctorSuccessPage'));
const PreDoctorSchedulePage = lazy(() => import('./pages/PreDoctorSchedulePage'));

// Patient pages
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage'));
const PatientOwnProfilePage = lazy(() => import('./pages/PatientOwnProfilePage'));
const PatientAppointmentsPage = lazy(() => import('./pages/PatientAppointmentsPage'));
const PatientMedicalHistoryPage = lazy(() => import('./pages/PatientMedicalHistoryPage'));
const PatientDashboardPage = lazy(() => import('./pages/PatientDashboardPage'));

// Doctor pages
const DoctorDashboardPage = lazy(() => import('./pages/DoctorDashboardPage'));
const DoctorPatientsPage = lazy(() => import('./pages/DoctorPatientsPage'));
const DoctorAppointmentsPage = lazy(() => import('./pages/DoctorAppointmentsPage'));
const DoctorLabRequestPage = lazy(() => import('./pages/DoctorLabRequestPage'));
const DoctorPatientProfilePage = lazy(() => import('./pages/DoctorPatientProfilePage'));
const DoctorMedicalHistoryPage = lazy(() => import('./pages/DoctorMedicalHistoryPage'));
const DoctorReportsPage = lazy(() => import('./pages/DoctorReportsPage'));
const DoctorReferralsPage = lazy(() => import('./pages/DoctorReferralsPage'));
const DoctorCertificatesPage = lazy(() => import('./pages/DoctorCertificatesPage'));
const DoctorEncounterPage = lazy(() => import('./pages/DoctorEncounterPage'));

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <AuthProvider>
            <BrandProvider>
              <ErrorBoundary>
                <Router>
                  <Suspense fallback={<LoadingSkeleton rows={8} />}>
                    <Routes>
                    {/* Public */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/marketing" element={<MarketingPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Secretary */}
                    <Route path="/dashboard" element={<ProtectedRoute requiredRole="secretary"><DashboardPage /></ProtectedRoute>} />
                    <Route path="/patients" element={<ProtectedRoute requiredRole="secretary"><PatientsPage /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute requiredRole="secretary"><AppointmentsPage /></ProtectedRoute>} />
                    <Route path="/billing" element={<ProtectedRoute requiredRole="secretary"><BillingPage /></ProtectedRoute>} />
                    <Route path="/billing/new" element={<ProtectedRoute requiredRole="secretary"><CreateBillPage /></ProtectedRoute>} />
                    <Route path="/secretary-slots" element={<ProtectedRoute requiredRole="secretary"><SecretarySlotsPage /></ProtectedRoute>} />
                    <Route path="/secretary-booking" element={<ProtectedRoute requiredRole="secretary"><SecretaryBookingPage /></ProtectedRoute>} />

                    {/* Pre-doctor */}
                    <Route path="/predoctor-dashboard" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorDashboardPage /></ProtectedRoute>} />
                    <Route path="/predoctor-patients" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorPatientsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-appointments" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-new-check" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorCheckPage /></ProtectedRoute>} />
                    <Route path="/predoctor-notifications" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorNotificationsPage /></ProtectedRoute>} />
                    <Route path="/predoctor-success" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorSuccessPage /></ProtectedRoute>} />
                    <Route path="/predoctor-schedule" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorSchedulePage /></ProtectedRoute>} />

                    {/* Patient */}
                    <Route path="/patient-profile/:id" element={<ProtectedRoute><PatientProfilePage /></ProtectedRoute>} />
                    <Route path="/patient-profile" element={<ProtectedRoute requiredRole="patient"><PatientOwnProfilePage /></ProtectedRoute>} />
                    <Route path="/patient-appointments" element={<ProtectedRoute requiredRole="patient"><PatientAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/patient-dashboard" element={<ProtectedRoute requiredRole="patient"><PatientDashboardPage /></ProtectedRoute>} />
                    <Route path="/patient-history" element={<ProtectedRoute requiredRole="patient"><PatientMedicalHistoryPage /></ProtectedRoute>} />

                    {/* Doctor */}
                    <Route path="/doctor-dashboard" element={<ProtectedRoute requiredRole="doctor"><DoctorDashboardPage /></ProtectedRoute>} />
                    <Route path="/doctor-patients" element={<ProtectedRoute requiredRole="doctor"><DoctorPatientsPage /></ProtectedRoute>} />
                    <Route path="/doctor-appointments" element={<ProtectedRoute requiredRole="doctor"><DoctorAppointmentsPage /></ProtectedRoute>} />
                    <Route path="/doctor-lab-request" element={<ProtectedRoute requiredRole="doctor"><DoctorLabRequestPage /></ProtectedRoute>} />
                    <Route path="/doctor-patient/:id" element={<ProtectedRoute requiredRole="doctor"><DoctorPatientProfilePage /></ProtectedRoute>} />
                    <Route path="/doctor-patient-history/:id" element={<ProtectedRoute requiredRole="doctor"><DoctorMedicalHistoryPage /></ProtectedRoute>} />
                    <Route path="/doctor-reports" element={<ProtectedRoute requiredRole="doctor"><DoctorReportsPage /></ProtectedRoute>} />
                    <Route path="/doctor-referrals" element={<ProtectedRoute requiredRole="doctor"><DoctorReferralsPage /></ProtectedRoute>} />
                    <Route path="/doctor-certificates" element={<ProtectedRoute requiredRole="doctor"><DoctorCertificatesPage /></ProtectedRoute>} />
                    <Route path="/doctor-encounter/:appointmentId" element={<ProtectedRoute requiredRole="doctor"><DoctorEncounterPage /></ProtectedRoute>} />
                    <Route path="/doctor-encounter-id/:encounterId" element={<ProtectedRoute requiredRole="doctor"><DoctorEncounterPage /></ProtectedRoute>} />
                    <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </Router>
              </ErrorBoundary>
            </BrandProvider>
          </AuthProvider>
        </ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
