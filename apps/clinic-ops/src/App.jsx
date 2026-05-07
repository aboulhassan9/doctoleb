import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute, { AuthRedirect } from '@ui/components/ProtectedRoute';
import { ToastProvider } from '@ui/contexts/ToastContext';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { SidebarProvider } from '@ui/contexts/SidebarContext';
import { AuthProvider } from '@ui/contexts/AuthContext';
import { BrandProvider } from '@ui/contexts/BrandContext';
import ErrorBoundary from '@ui/components/ErrorBoundary';
import { LoadingSkeleton } from '@ui/components/ui';

// ──────────────────────────────────────────────
// Clinic-Ops — standalone router
// Only contains staff routes.
// Patient/public routes are in apps/patient-web.
// ──────────────────────────────────────────────

// Auth
const OpsLoginPage = lazy(() => import('./pages/OpsLoginPage'));

// Secretary
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const CreateBillPage = lazy(() => import('./pages/CreateBillPage'));
const SecretarySlotsPage = lazy(() => import('./pages/SecretarySlotsPage'));
const SecretaryBookingPage = lazy(() => import('./pages/SecretaryBookingPage'));

// Pre-doctor
const PreDoctorDashboardPage = lazy(() => import('./pages/PreDoctorDashboardPage'));
const PreDoctorPatientsPage = lazy(() => import('./pages/PreDoctorPatientsPage'));
const PreDoctorAppointmentsPage = lazy(() => import('./pages/PreDoctorAppointmentsPage'));
const PreDoctorCheckPage = lazy(() => import('./pages/PreDoctorCheckPage'));
const PreDoctorNotificationsPage = lazy(() => import('./pages/PreDoctorNotificationsPage'));
const PreDoctorSuccessPage = lazy(() => import('./pages/PreDoctorSuccessPage'));
const PreDoctorSchedulePage = lazy(() => import('./pages/PreDoctorSchedulePage'));
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage'));

// Doctor
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
const DoctorScheduleTemplatesPage = lazy(() => import('./pages/DoctorScheduleTemplatesPage'));
const DoctorStaffPage = lazy(() => import('./pages/DoctorStaffPage'));
const DoctorTenantSettingsPage = lazy(() => import('./pages/DoctorTenantSettingsPage'));
const DoctorClinicalCatalogsPage = lazy(() => import('./pages/DoctorClinicalCatalogsPage'));
const SecretaryOpsCatalogsPage = lazy(() => import('./pages/SecretaryOpsCatalogsPage'));
const SecretaryInsuranceProvidersPage = lazy(() => import('./pages/SecretaryInsuranceProvidersPage'));
const SecretaryPatientInsurancePage = lazy(() => import('./pages/SecretaryPatientInsurancePage'));
const SecretaryIntakePage = lazy(() => import('./pages/SecretaryIntakePage'));
const SecretaryClaimTemplatesPage = lazy(() => import('./pages/SecretaryClaimTemplatesPage'));
const DoctorClaimPage = lazy(() => import('./pages/DoctorClaimPage'));

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <AuthProvider>
            <BrandProvider appSurface="clinic-ops">
              <ErrorBoundary>
                <Router>
                  <Suspense fallback={<LoadingSkeleton rows={8} />}>
                    <Routes>
                      {/* Staff login */}
                      <Route path="/" element={<Navigate to="/login" replace />} />
                      <Route path="/login" element={<AuthRedirect intendedSurface="clinic-ops" redirectAll><OpsLoginPage /></AuthRedirect>} />

                      {/* Secretary */}
                      <Route path="/dashboard" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><DashboardPage /></ProtectedRoute>} />
                      <Route path="/patients" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><PatientsPage /></ProtectedRoute>} />
                      <Route path="/appointments" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><AppointmentsPage /></ProtectedRoute>} />
                      <Route path="/billing" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><BillingPage /></ProtectedRoute>} />
                      <Route path="/billing/new" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><CreateBillPage /></ProtectedRoute>} />
                      <Route path="/secretary-slots" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretarySlotsPage /></ProtectedRoute>} />
                      <Route path="/secretary-booking" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryBookingPage /></ProtectedRoute>} />
                      <Route path="/secretary-intake/:patientId" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryIntakePage /></ProtectedRoute>} />
                      <Route path="/secretary-ops-catalogs" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryOpsCatalogsPage /></ProtectedRoute>} />
                      <Route path="/secretary-insurance-providers" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryInsuranceProvidersPage /></ProtectedRoute>} />
                      <Route path="/secretary-patient-insurance/:patientId" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryPatientInsurancePage /></ProtectedRoute>} />
                      <Route path="/secretary-claim-templates" element={<ProtectedRoute requiredRole="secretary" appSurface="clinic-ops"><SecretaryClaimTemplatesPage /></ProtectedRoute>} />

                      {/* Pre-doctor */}
                      <Route path="/predoctor-dashboard" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorDashboardPage /></ProtectedRoute>} />
                      <Route path="/predoctor-patients" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorPatientsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-appointments" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorAppointmentsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-new-check" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorCheckPage /></ProtectedRoute>} />
                      <Route path="/predoctor-notifications" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorNotificationsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-success" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorSuccessPage /></ProtectedRoute>} />
                      <Route path="/predoctor-schedule" element={<ProtectedRoute requiredRole="predoctor" appSurface="clinic-ops"><PreDoctorSchedulePage /></ProtectedRoute>} />
                      <Route path="/patient-profile/:id" element={<ProtectedRoute allowedRoles={['doctor', 'predoctor', 'secretary']} appSurface="clinic-ops"><PatientProfilePage /></ProtectedRoute>} />

                      {/* Doctor */}
                      <Route path="/doctor-dashboard" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorDashboardPage /></ProtectedRoute>} />
                      <Route path="/doctor-patients" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorPatientsPage /></ProtectedRoute>} />
                      <Route path="/doctor-appointments" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorAppointmentsPage /></ProtectedRoute>} />
                      <Route path="/doctor-lab-request" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorLabRequestPage /></ProtectedRoute>} />
                      <Route path="/doctor-patient/:id" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorPatientProfilePage /></ProtectedRoute>} />
                      <Route path="/doctor-patient-history/:id" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorMedicalHistoryPage /></ProtectedRoute>} />
                      <Route path="/doctor-reports" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorReportsPage /></ProtectedRoute>} />
                      <Route path="/doctor-referrals" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorReferralsPage /></ProtectedRoute>} />
                      <Route path="/doctor-certificates" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorCertificatesPage /></ProtectedRoute>} />
                      <Route path="/doctor-encounter/:appointmentId" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorEncounterPage /></ProtectedRoute>} />
                      <Route path="/doctor-encounter-id/:encounterId" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorEncounterPage /></ProtectedRoute>} />
                      <Route path="/doctor-schedule" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorScheduleTemplatesPage /></ProtectedRoute>} />
                      <Route path="/doctor-staff" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorStaffPage /></ProtectedRoute>} />
                      <Route path="/doctor-tenant-settings" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorTenantSettingsPage /></ProtectedRoute>} />
                      <Route path="/doctor-clinical-catalogs" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorClinicalCatalogsPage /></ProtectedRoute>} />
                      <Route path="/doctor-claims" element={<ProtectedRoute requiredRole="doctor" appSurface="clinic-ops"><DoctorClaimPage /></ProtectedRoute>} />

                      <Route path="*" element={<Navigate to="/login" replace />} />
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
