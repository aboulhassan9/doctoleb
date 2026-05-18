import { motion } from 'framer-motion';
import { ShieldCheck, LogOut, Cable, Info, Mail } from 'lucide-react';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Card, CardContent, SecondaryButton, SettingsSection } from './ui';
import ProviderConnectionsPanel from './ProviderConnectionsPanel';

export default function SettingsScreen({
  providerConnections,
  providerConnectionsLoading,
  onProviderConnectionsChanged,
  session,
  onSignOut,
}) {
  const email = session?.user?.email || 'Unknown administrator';

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-10">
      <motion.div variants={staggerItem}>
        <SettingsSection
          title="Console Session"
          description="The administrator account currently signed in to this control plane."
          icon={ShieldCheck}
        >
          <Card>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {email.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{email}</p>
                  <p className="font-mono text-xs text-slate-400">Control-plane administrator</p>
                </div>
              </div>
              <SecondaryButton onClick={onSignOut}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </SecondaryButton>
            </CardContent>
          </Card>
        </SettingsSection>
      </motion.div>

      <motion.div variants={staggerItem}>
        <SettingsSection
          title="Hosting Providers"
          description="Connect Supabase or Vercel account metadata for assisted tenant provisioning. Secret references only — never raw keys."
          icon={Cable}
        >
          <ProviderConnectionsPanel
            connections={providerConnections}
            loading={providerConnectionsLoading}
            onChanged={onProviderConnectionsChanged}
          />
        </SettingsSection>
      </motion.div>

      <motion.div variants={staggerItem}>
        <SettingsSection
          title="About & Support"
          description="Version, environment, and where to get help with the console."
          icon={Info}
        >
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">Console</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">DoctoLeb Control Plane</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">Version</p>
                  <p className="mt-1 font-mono text-sm font-medium text-slate-900">v3.0.0</p>
                </div>
              </div>
              <a
                href="mailto:support@doctoleb.com"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800"
              >
                <Mail className="h-4 w-4" />
                Contact platform support
              </a>
            </CardContent>
          </Card>
        </SettingsSection>
      </motion.div>
    </motion.div>
  );
}
