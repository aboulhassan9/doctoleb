import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { MessagingPage } from '@ui/components/messaging/MessagingPage';

/**
 * Staff-facing messages inbox.
 *
 * The route guard restricts access to clinic-ops login roles
 * (`CLINIC_OPS_ROLES` from appBoundaries). The DashboardLayout/AppSidebar
 * already falls back to a default sidebar for any unrecognized role, so we
 * pass `user.role` through directly without a local allowlist.
 */
export default function StaffMessagesPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout role={user?.role}>
      <div className="px-8 py-6 h-full flex flex-col min-h-0">
        <header className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-sm text-slate-500">Patient conversations and clinic-wide messaging</p>
        </header>
        <div className="flex-1 min-h-0">
          <MessagingPage mode="staff" className="h-full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
