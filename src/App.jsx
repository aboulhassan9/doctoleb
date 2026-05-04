import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import SignUpPage from './pages/SignUpPage';
import MarketingPage from './pages/MarketingPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import DashboardPage from './pages/DashboardPage';
import PreDoctorDashboardPage from './pages/PreDoctorDashboardPage';
import PreDoctorPatientsPage from './pages/PreDoctorPatientsPage';
import PreDoctorAppointmentsPage from './pages/PreDoctorAppointmentsPage';
import PreDoctorCheckPage from './pages/PreDoctorCheckPage';
import PreDoctorNotificationsPage from './pages/PreDoctorNotificationsPage';
import PreDoctorSuccessPage from './pages/PreDoctorSuccessPage';
import PatientProfilePage from './pages/PatientProfilePage';
import PatientOwnProfilePage from './pages/PatientOwnProfilePage';
import PatientAppointmentsPage from './pages/PatientAppointmentsPage';
import PatientMedicalHistoryPage from './pages/PatientMedicalHistoryPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import DoctorDashboardPage from './pages/DoctorDashboardPage';
import DoctorPatientsPage from './pages/DoctorPatientsPage';
import DoctorAppointmentsPage from './pages/DoctorAppointmentsPage';
import DoctorConsultationPage from './pages/DoctorConsultationPage';
import DoctorLabRequestPage from './pages/DoctorLabRequestPage';
import DoctorPatientProfilePage from './pages/DoctorPatientProfilePage';
import DoctorMedicalHistoryPage from './pages/DoctorMedicalHistoryPage';
import DoctorReportsPage from './pages/DoctorReportsPage';
import DoctorReferralsPage from './pages/DoctorReferralsPage';
import DoctorCertificatesPage from './pages/DoctorCertificatesPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import BillingPage from './pages/BillingPage';
import CreateBillPage from './pages/CreateBillPage';
import SecretarySlotsPage from './pages/SecretarySlotsPage';
import SecretaryBookingPage from './pages/SecretaryBookingPage';
import PreDoctorSchedulePage from './pages/PreDoctorSchedulePage';

import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <Router>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/marketing" element={<MarketingPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/dashboard" element={<ProtectedRoute requiredRole="secretary"><DashboardPage /></ProtectedRoute>} />
                  <Route path="/predoctor-dashboard" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorDashboardPage /></ProtectedRoute>} />
                  <Route path="/predoctor-patients" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorPatientsPage /></ProtectedRoute>} />
                  <Route path="/predoctor-appointments" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorAppointmentsPage /></ProtectedRoute>} />
                  <Route path="/predoctor-new-check" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorCheckPage /></ProtectedRoute>} />
                  <Route path="/predoctor-notifications" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorNotificationsPage /></ProtectedRoute>} />
                  <Route path="/predoctor-success" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorSuccessPage /></ProtectedRoute>} />
                  <Route path="/patient-profile/:id" element={<ProtectedRoute><PatientProfilePage /></ProtectedRoute>} />
                  <Route path="/patient-profile" element={<ProtectedRoute requiredRole="patient"><PatientOwnProfilePage /></ProtectedRoute>} />
                  <Route path="/patient-appointments" element={<ProtectedRoute requiredRole="patient"><PatientAppointmentsPage /></ProtectedRoute>} />
                  <Route path="/patient-dashboard" element={<ProtectedRoute requiredRole="patient"><PatientDashboardPage /></ProtectedRoute>} />
                  <Route path="/patient-history" element={<ProtectedRoute requiredRole="patient"><PatientMedicalHistoryPage /></ProtectedRoute>} />
                  <Route path="/doctor-dashboard" element={<ProtectedRoute requiredRole="doctor"><DoctorDashboardPage /></ProtectedRoute>} />
                  <Route path="/doctor-patients" element={<ProtectedRoute requiredRole="doctor"><DoctorPatientsPage /></ProtectedRoute>} />
                  <Route path="/doctor-appointments" element={<ProtectedRoute requiredRole="doctor"><DoctorAppointmentsPage /></ProtectedRoute>} />
                  <Route path="/doctor-consultation" element={<ProtectedRoute requiredRole="doctor"><DoctorConsultationPage /></ProtectedRoute>} />
                  <Route path="/doctor-consultation/:id" element={<ProtectedRoute requiredRole="doctor"><DoctorConsultationPage /></ProtectedRoute>} />
                  <Route path="/doctor-lab-request" element={<ProtectedRoute requiredRole="doctor"><DoctorLabRequestPage /></ProtectedRoute>} />
                  <Route path="/doctor-patient/:id" element={<ProtectedRoute requiredRole="doctor"><DoctorPatientProfilePage /></ProtectedRoute>} />
                  <Route path="/doctor-patient-history/:id" element={<ProtectedRoute requiredRole="doctor"><DoctorMedicalHistoryPage /></ProtectedRoute>} />
                  <Route path="/doctor-reports" element={<ProtectedRoute requiredRole="doctor"><DoctorReportsPage /></ProtectedRoute>} />
                  <Route path="/doctor-referrals" element={<ProtectedRoute requiredRole="doctor"><DoctorReferralsPage /></ProtectedRoute>} />
                  <Route path="/doctor-certificates" element={<ProtectedRoute requiredRole="doctor"><DoctorCertificatesPage /></ProtectedRoute>} />
                  <Route path="/patients" element={<ProtectedRoute requiredRole="secretary"><PatientsPage /></ProtectedRoute>} />
                  <Route path="/appointments" element={<ProtectedRoute requiredRole="secretary"><AppointmentsPage /></ProtectedRoute>} />
                  <Route path="/billing" element={<ProtectedRoute requiredRole="secretary"><BillingPage /></ProtectedRoute>} />
                  <Route path="/billing/new" element={<ProtectedRoute requiredRole="secretary"><CreateBillPage /></ProtectedRoute>} />
                  <Route path="/secretary-slots" element={<ProtectedRoute requiredRole="secretary"><SecretarySlotsPage /></ProtectedRoute>} />
                  <Route path="/secretary-booking" element={<ProtectedRoute requiredRole="secretary"><SecretaryBookingPage /></ProtectedRoute>} />
                  <Route path="/predoctor-schedule" element={<ProtectedRoute requiredRole="predoctor"><PreDoctorSchedulePage /></ProtectedRoute>} />
                </Routes>
              </Router>
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

export default App;
