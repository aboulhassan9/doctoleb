import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { staggerContainer, staggerItem } from '../lib/motion';
import { Card, CardContent } from './ui';

function statusColor(status) {
  if (status === 'active') return '#0d9488';
  if (['provisioning', 'pending', 'maintenance'].includes(status)) return '#f59e0b';
  if (['suspended', 'failed'].includes(status)) return '#e11d48';
  return '#94a3b8';
}

function buildGrowth(tenants) {
  const byMonth = {};
  for (const tenant of tenants) {
    if (!tenant.created_at) continue;
    const date = new Date(tenant.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  }
  let cumulative = 0;
  return Object.keys(byMonth)
    .sort()
    .map((key) => {
      cumulative += byMonth[key];
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      return { month: label, tenants: cumulative };
    });
}

const AXIS = { fontSize: 11, fill: '#94a3b8' };
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

function ChartCard({ title, subtitle, children }) {
  return (
    <motion.div variants={staggerItem}>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
        <BarChart3 className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-slate-500">No tenant data to chart yet.</p>
    </div>
  );
}

export default function AnalyticsScreen({ tenants = [] }) {
  const hasData = tenants.length > 0;
  const growth = buildGrowth(tenants);

  const statusCounts = {};
  const planCounts = {};
  for (const tenant of tenants) {
    const status = tenant.status || 'unknown';
    const plan = tenant.plan || 'starter';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  }
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const planData = Object.entries(planCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <motion.div variants={staggerItem} className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Platform analytics</h1>
        <p className="text-sm text-slate-500">Tenant growth, lifecycle status, and plan distribution across the platform.</p>
      </motion.div>

      <ChartCard title="Tenant growth" subtitle="Cumulative tenants created over time">
        {hasData && growth.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={growth} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={AXIS} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#cbd5e1' }} />
              <Area
                type="monotone"
                dataKey="tenants"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#growthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Status distribution" subtitle="Tenants by lifecycle status">
          {hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
          {hasData ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {statusData.map((entry) => (
                <span key={entry.name} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(entry.name) }} />
                  <span className="font-mono uppercase tracking-wide">{entry.name}</span>
                  <span className="tabular-nums text-slate-400">{entry.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </ChartCard>

        <ChartCard title="Plan distribution" subtitle="Tenants by subscription plan">
          {hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={planData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </motion.div>
  );
}
