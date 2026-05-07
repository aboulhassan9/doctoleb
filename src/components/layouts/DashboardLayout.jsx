import AppSidebar from '@/components/AppSidebar';
import MobileTopBar from '@/components/MobileTopBar';

/**
 * DashboardLayout — Shared page shell for all staff dashboards.
 *
 * Eliminates the layout boilerplate from every dashboard page:
 *   <div className="flex h-screen ..."><Sidebar /><main>...</main></div>
 *
 * Usage:
 *   <DashboardLayout role="doctor">
 *     <TopBar ... />
 *     <div className="p-8">...page content...</div>
 *   </DashboardLayout>
 *
 * @param {{ role: 'doctor' | 'predoctor' | 'secretary', title?: string, children: React.ReactNode }} props
 */
export default function DashboardLayout({ role = 'secretary', title = 'DoctoLeb', children }) {
  const normalizedRole = role === 'pre_doctor' ? 'predoctor' : role;

  return (
    <div className="flex h-screen w-full bg-[var(--bg-base)] text-[var(--text-base)] overflow-hidden">
      <AppSidebar role={normalizedRole} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <MobileTopBar title={title} />
        {children}
      </main>
    </div>
  );
}
