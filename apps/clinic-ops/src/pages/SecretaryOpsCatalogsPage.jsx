import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import CatalogAdminPanel from '../components/CatalogAdminPanel';
import { stagger, fadeUp } from '@core/lib/animations';

const OPS_CATALOGS = [
  { key: 'cities', label: 'Cities' },
  { key: 'occupations', label: 'Occupations' },
  { key: 'blood_groups', label: 'Blood Groups' },
  { key: 'family_relations', label: 'Family Relations' },
];

export default function SecretaryOpsCatalogsPage() {
  return (
    <DashboardLayout role="secretary" pageTitle="Operations Catalogs">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-slate-900">Operations Catalogs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage reference data for operations — cities, occupations, blood groups, and family relations.
            System entries are read-only; custom entries can be managed freely.
          </p>
        </motion.div>
        {OPS_CATALOGS.map((cat) => (
          <CatalogAdminPanel key={cat.key} catalogKey={cat.key} catalogLabel={cat.label} />
        ))}
      </motion.div>
    </DashboardLayout>
  );
}
