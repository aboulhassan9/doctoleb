/**
 * PatientPageHeader — Shared sticky header for patient-web pages.
 *
 * Replaces near-identical header blocks in PatientMessagesPage,
 * PatientMedicalHistoryPage, etc. — each page just supplies its title and
 * subtitle. Logout and back-to-dashboard navigation live in one place.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CreditCard,
  FileClock,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { getUserInitials } from '@/lib/userDisplay';
import { getHomeRouteForRole } from '@/lib/routes';

const NAV_ITEMS = [
  { label: 'Overview', path: '/patient-dashboard', icon: LayoutDashboard },
  { label: 'Readiness', path: '/patient-onboarding', icon: ShieldCheck },
  { label: 'Appointments', path: '/patient-appointments', icon: CalendarDays },
  { label: 'Check-In', path: '/patient-check-in', icon: HeartPulse },
  { label: 'Records', path: '/patient-history', icon: FileClock },
  { label: 'Billing', path: '/patient-billing', icon: CreditCard },
  { label: 'Messages', path: '/patient-messages', icon: MessageCircle },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.label !== 'Readiness');

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
  const location = useLocation();
  const { user, logout } = useAuth();
  const { displayName, tagline } = useBrand();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="patient-header">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/patient-dashboard')}
            className="patient-brand-lockup group flex min-w-0 items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[var(--patient-sage)]"
          >
            <span className="patient-avatar">
              {getUserInitials(user)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black uppercase tracking-[0.18em] text-[var(--patient-sage)]">
                {displayName}
              </span>
              <span className="patient-display block truncate text-xl font-medium tracking-tight text-[var(--patient-ink)]">
                {title}
              </span>
              {subtitle && <span className="block truncate text-xs font-semibold text-[var(--patient-muted)]">{subtitle}</span>}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {showBackToDashboard && (
              <button
                type="button"
                onClick={() => navigate(getHomeRouteForRole(user?.role))}
                className="patient-header-action hidden px-4 py-2 text-sm font-bold sm:inline-flex"
              >
                Dashboard
              </button>
            )}
            {showLogout && (
              <button
                type="button"
                onClick={handleLogout}
                className="patient-header-action inline-flex h-10 w-10 items-center justify-center hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-2 overflow-x-auto pb-1 sm:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.endsWith(item.path);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className="patient-nav-pill group focus:outline-none focus:ring-2 focus:ring-[var(--patient-sage)]"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
          <span className="ml-auto hidden shrink-0 items-center gap-2 rounded-full bg-[var(--patient-sage-soft)] px-3 py-2 text-xs font-bold text-[var(--patient-sage)] lg:inline-flex">
            <UserRound className="h-3.5 w-3.5" />
            {tagline}
          </span>
        </div>
      </div>

      <nav
        className="patient-mobile-nav px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:hidden"
        aria-label="Patient mobile navigation"
      >
        <div className="grid grid-cols-6 gap-1">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.endsWith(item.path);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className="patient-mobile-nav-item flex flex-col items-center justify-center gap-1 px-1 focus:outline-none focus:ring-2 focus:ring-[var(--patient-sage)]"
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
