import { motion } from 'framer-motion';
import { Building2, ChevronRight } from 'lucide-react';
import { staggerContainer, staggerItem } from '../lib/motion';
import { StatusPill } from './ui';

export default function TenantList({ tenants, onSelect }) {
  if (!tenants || tenants.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
          <Building2 className="h-6 w-6" />
        </span>
        <h3 className="text-base font-semibold text-slate-900">No tenants found</h3>
        <p className="mt-1 text-sm text-slate-500">Get started by creating a new tenant.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {['Clinic Name', 'Plan', 'Health Status', 'Created', 'Slug'].map((heading) => (
              <th
                key={heading}
                className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wide text-slate-500"
              >
                {heading}
              </th>
            ))}
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <motion.tbody
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="divide-y divide-slate-100"
        >
          {tenants.map((tenant) => (
            <motion.tr
              key={tenant.id}
              variants={staggerItem}
              onClick={() => onSelect(tenant)}
              className="group cursor-pointer transition-colors hover:bg-slate-50"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-medium text-slate-900">{tenant.display_name}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm capitalize text-slate-600">{tenant.plan || 'Starter'}</td>
              <td className="px-4 py-2.5">
                <StatusPill value={tenant.status} />
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-500">
                {new Date(tenant.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{tenant.slug}</td>
              <td className="px-4 py-2.5 text-right">
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
