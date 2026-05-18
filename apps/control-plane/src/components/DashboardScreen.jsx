import { motion } from 'framer-motion';
import { Building2, CheckCircle2, Clock, AlertTriangle, Plus, ArrowRight, Activity } from 'lucide-react';
import { EASE, staggerContainer, staggerItem } from '../lib/motion';
import { Card, CardContent, CountUp, StatusPill } from './ui';

const TONE_CHIP = {
  slate: 'bg-slate-100 text-slate-500',
  success: 'bg-emerald-50 text-emerald-600',
  accent: 'bg-teal-50 text-teal-600',
  danger: 'bg-rose-50 text-rose-600',
};

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  return (
    <motion.div variants={staggerItem} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${TONE_CHIP[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}

export default function DashboardScreen({ tenants = [], loading = false, onSelectTenant, onCreateTenant }) {
  const total = tenants.length;

  const statusCounts = {};
  for (const tenant of tenants) {
    const status = tenant.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const recent = [...tenants]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 6);

  const statusRows = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  const stats = [
    { label: 'Total Tenants', value: total, icon: Building2, tone: 'slate' },
    { label: 'Active', value: statusCounts.active || 0, icon: CheckCircle2, tone: 'success' },
    { label: 'Provisioning', value: statusCounts.provisioning || 0, icon: Clock, tone: 'accent' },
    { label: 'Suspended', value: statusCounts.suspended || 0, icon: AlertTriangle, tone: 'danger' },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <motion.div variants={staggerItem} className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Operations overview</h1>
        <p className="text-sm text-slate-500">Live snapshot of every clinic tenant on the DoctoLeb platform.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <motion.div variants={staggerItem}>
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Recent tenants</h2>
              <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400">{total} total</span>
            </div>
            <CardContent className="p-0">
              {loading ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">Loading tenants...</p>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold text-slate-900">No tenants yet</p>
                  <button
                    onClick={onCreateTenant}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 transition-colors hover:text-teal-800"
                  >
                    <Plus className="h-4 w-4" />
                    Create the first tenant
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recent.map((tenant) => (
                    <li key={tenant.id}>
                      <button
                        onClick={() => onSelectTenant(tenant)}
                        className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{tenant.display_name}</p>
                            <p className="truncate font-mono text-xs text-slate-400">{tenant.slug}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusPill value={tenant.status} />
                          <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem} className="flex flex-col gap-6">
          <Card>
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Tenants by status</h2>
            </div>
            <CardContent className="flex flex-col gap-3.5">
              {statusRows.length === 0 ? (
                <p className="text-sm text-slate-500">No data yet.</p>
              ) : (
                statusRows.map(([status, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={status} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <StatusPill value={status} />
                        <span className="font-mono text-xs tabular-nums text-slate-500">
                          {count} &middot; {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className="h-full rounded-full bg-teal-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: EASE }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="flex flex-col gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Provision a new clinic</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Run the guided installer to create a tenant draft, pending domains, and a readiness checklist.
                </p>
              </div>
              <button
                onClick={onCreateTenant}
                className="mt-1 inline-flex h-9 items-center justify-center gap-2 self-start rounded-md bg-white px-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                Add New Tenant
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
