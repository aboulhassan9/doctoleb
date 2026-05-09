import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute, { AuthRedirect } from '@ui/components/ProtectedRoute';
import FeatureProtectedRoute from '@ui/components/FeatureProtectedRoute';
import { ENTITLEMENT_FEATURES } from '@core/lib/entitlements';
import { CLINIC_OPS_ROLES, APP_SURFACES } from '@/lib/appBoundaries';
import { ToastProvider } from '@ui/contexts/ToastContext';
import { ThemeProvider } from '@ui/contexts/ThemeContext';
import { SidebarProvider } from '@ui/contexts/SidebarContext';
import { AuthProvider } from '@ui/contexts/AuthContext';
import { BrandProvider } from '@ui/contexts/BrandContext';
import { TenantBootstrap } from '@ui/contexts/TenantBootstrap';
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
const StaffMessagesPage = lazy(() => import('./pages/StaffMessagesPage'));

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <TenantBootstrap appSurface={APP_SURFACES.clinicOps}>
          <AuthProvider>
            <BrandProvider appSurface={APP_SURFACES.clinicOps}>
              <ErrorBoundary>
                <Router>
                  <Suspense fallback={<LoadingSkeleton rows={8} />}>
                    <Routes>
                      {/* Staff login */}
                      <Route path="/" element={<Navigate to="/login" replace />} />
                      <Route path="/login" element={<AuthRedirect intendedSurface="clinic-ops" redirectAll><OpsLoginPage /></AuthRedirect>} />

                      {/* Secretary */}
                      <Route path="/dashboard" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><DashboardPage /></ProtectedRoute>} />
                      <Route path="/patients" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><PatientsPage /></ProtectedRoute>} />
                      <Route path="/appointments" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><AppointmentsPage /></ProtectedRoute>} />
                      <Route path="/billing" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><BillingPage /></ProtectedRoute>} />
                      <Route path="/billing/new" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><CreateBillPage /></ProtectedRoute>} />
                      <Route path="/secretary-slots" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretarySlotsPage /></ProtectedRoute>} />
                      <Route path="/secretary-booking" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretaryBookingPage /></ProtectedRoute>} />
                      <Route path="/secretary-intake/:patientId" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretaryIntakePage /></ProtectedRoute>} />
                      <Route path="/secretary-ops-catalogs" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><SecretaryOpsCatalogsPage /></ProtectedRoute>} />
                      <Route path="/secretary-insurance-providers" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.insuranceBilling} audience="staff"><SecretaryInsuranceProvidersPage /></FeatureProtectedRoute></ProtectedRoute>} />
                      <Route path="/secretary-patient-insurance/:patientId" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.insuranceBilling} audience="staff"><SecretaryPatientInsurancePage /></FeatureProtectedRoute></ProtectedRoute>} />
                      <Route path="/secretary-claim-templates" element={<ProtectedRoute requiredRole="secretary" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.insuranceBilling} audience="staff"><SecretaryClaimTemplatesPage /></FeatureProtectedRoute></ProtectedRoute>} />

                      {/* Pre-doctor */}
                      <Route path="/predoctor-dashboard" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorDashboardPage /></ProtectedRoute>} />
                      <Route path="/predoctor-patients" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorPatientsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-appointments" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorAppointmentsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-new-check" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorCheckPage /></ProtectedRoute>} />
                      <Route path="/predoctor-notifications" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorNotificationsPage /></ProtectedRoute>} />
                      <Route path="/predoctor-success" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorSuccessPage /></ProtectedRoute>} />
                      <Route path="/predoctor-schedule" element={<ProtectedRoute requiredRole="predoctor" appSurface={APP_SURFACES.clinicOps}><PreDoctorSchedulePage /></ProtectedRoute>} />
                      <Route path="/patient-profile/:id" element={<ProtectedRoute allowedRoles={['doctor', 'predoctor', 'secretary']} appSurface={APP_SURFACES.clinicOps}><PatientProfilePage /></ProtectedRoute>} />

                      {/* Doctor */}
                      <Route path="/doctor-dashboard" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorDashboardPage /></ProtectedRoute>} />
                      <Route path="/doctor-patients" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorPatientsPage /></ProtectedRoute>} />
                      <Route path="/doctor-appointments" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorAppointmentsPage /></ProtectedRoute>} />
                      <Route path="/doctor-lab-request" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorLabRequestPage /></ProtectedRoute>} />
                      <Route path="/doctor-patient/:id" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorPatientProfilePage /></ProtectedRoute>} />
                      <Route path="/doctor-patient-history/:id" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorMedicalHistoryPage /></ProtectedRoute>} />
                      <Route path="/doctor-reports" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.advancedReports} audience="staff"><DoctorReportsPage /></FeatureProtectedRoute></ProtectedRoute>} />
                      <Route path="/doctor-referrals" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorReferralsPage /></ProtectedRoute>} />
                      <Route path="/doctor-certificates" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorCertificatesPage /></ProtectedRoute>} />
                      <Route path="/doctor-encounter/:appointmentId" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorEncounterPage /></ProtectedRoute>} />
                      <Route path="/doctor-encounter-id/:encounterId" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorEncounterPage /></ProtectedRoute>} />
                      <Route path="/doctor-schedule" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorScheduleTemplatesPage /></ProtectedRoute>} />
                      <Route path="/doctor-staff" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.staffAccounts} audience="staff"><DoctorStaffPage /></FeatureProtectedRoute></ProtectedRoute>} />
                      <Route path="/doctor-tenant-settings" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorTenantSettingsPage /></ProtectedRoute>} />
                      <Route path="/doctor-clinical-catalogs" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><DoctorClinicalCatalogsPage /></ProtectedRoute>} />
                      <Route path="/doctor-claims" element={<ProtectedRoute requiredRole="doctor" appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.insuranceBilling} audience="staff"><DoctorClaimPage /></FeatureProtectedRoute></ProtectedRoute>} />

                      {/* Shared messaging — accessible to all clinic-ops staff */}
                      <Route path="/staff-messages" element={<ProtectedRoute allowedRoles={CLINIC_OPS_ROLES} appSurface={APP_SURFACES.clinicOps}><FeatureProtectedRoute featureCode={ENTITLEMENT_FEATURES.messaging} audience="staff"><StaffMessagesPage /></FeatureProtectedRoute></ProtectedRoute>} />

                      <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                  </Suspense>
                </Router>
              </ErrorBoundary>
            </BrandProvider>
          </AuthProvider>
          </TenantBootstrap>
        </ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
