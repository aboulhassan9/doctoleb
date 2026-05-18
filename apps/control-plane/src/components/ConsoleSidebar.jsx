import { motion } from 'framer-motion';
import { LayoutDashboard, Building2, BarChart3, Settings, Plus, HelpCircle, LogOut } from 'lucide-react';
import { staggerContainer, staggerItem } from '../lib/motion';
import BrandLockup from './BrandLockup';

const NAV_TRANSITION = { type: 'spring', stiffness: 420, damping: 36 };

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <motion.button
      variants={staggerItem}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
      }`}
    >
      {active && (
        <>
          <motion.span
            layoutId="navActiveBg"
            transition={NAV_TRANSITION}
            className="absolute inset-0 rounded-md bg-slate-900"
          />
          <motion.span
            layoutId="navActiveBar"
            transition={NAV_TRANSITION}
            className="absolute inset-y-1.5 left-0 z-10 w-0.5 rounded-r-full bg-teal-400"
          />
        </>
      )}
      <Icon
        className={`relative z-10 h-4 w-4 ${active ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`}
      />
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}

export default function ConsoleSidebar({ selectedTenant, workspaceMode, onNavigate, onCreateTenant, onSignOut }) {
  const onTenants = workspaceMode === 'tenant' || workspaceMode === 'create' || Boolean(selectedTenant);

  return (
    <nav className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-900 px-5 py-5">
        <BrandLockup />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5"
      >
        <motion.p
          variants={staggerItem}
          className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600"
        >
          Workspace
        </motion.p>
        <NavItem
          icon={LayoutDashboard}
          label="Dashboard"
          active={!selectedTenant && workspaceMode === 'dashboard'}
          onClick={() => onNavigate('dashboard')}
        />
        <NavItem icon={Building2} label="Tenants" active={onTenants} onClick={() => onNavigate('tenants')} />
        <NavItem
          icon={BarChart3}
          label="Analytics"
          active={workspaceMode === 'analytics'}
          onClick={() => onNavigate('analytics')}
        />
        <NavItem
          icon={Settings}
          label="Global Settings"
          active={workspaceMode === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </motion.div>

      <div className="flex flex-col gap-1 border-t border-slate-900 px-3 py-4">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCreateTenant}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
        >
          <Plus className="h-4 w-4" />
          Add New Tenant
        </motion.button>
        <button
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-slate-200"
        >
          <HelpCircle className="h-4 w-4 text-slate-500" />
          Help Center
        </button>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4 text-slate-500" />
          Sign Out
        </button>
        <p className="mt-3 border-t border-slate-900 px-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
          console.doctoleb.com
        </p>
      </div>
    </nav>
  );
}
