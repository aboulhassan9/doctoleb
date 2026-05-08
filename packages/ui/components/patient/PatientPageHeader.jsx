/**
 * PatientPageHeader — Shared sticky header for patient-web pages.
 *
 * Replaces near-identical header blocks in PatientMessagesPage,
 * PatientMedicalHistoryPage, etc. — each page just supplies its title and
 * subtitle. Logout and back-to-dashboard navigation live in one place.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getUserInitials } from '@/lib/userDisplay';
import { getHomeRouteForRole } from '@/lib/routes';

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   showBackToDashboard?: boolean,
 *   showLogout?: boolean,
 * }} props
 */
export default function PatientPageHeader({
  title,
  subtitle,
  showBackToDashboard = true,
  showLogout = true,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black">
            {getUserInitials(user)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {showBackToDashboard && (
            <button
              onClick={() => navigate(getHomeRouteForRole(user?.role))}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              Back to Dashboard
            </button>
          )}
          {showLogout && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
