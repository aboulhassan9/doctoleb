import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import CatalogAdminPanel from '../components/CatalogAdminPanel';
import { stagger, fadeUp } from '@core/lib/animations';

const CLINICAL_CATALOGS = [
  { key: 'specialties', label: 'Specialties' },
  { key: 'vaccines', label: 'Vaccines' },
  { key: 'diseases', label: 'Diseases' },
  { key: 'surgery_types', label: 'Surgery Types' },
  { key: 'visit_types', label: 'Visit Types' },
];

export default function DoctorClinicalCatalogsPage() {
  return (
    <DashboardLayout role="doctor" pageTitle="Clinical Catalogs">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-slate-900">Clinical Catalogs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage reference data used across the practice — specialties, vaccines, diseases, surgery types, and visit types.
            System entries are locked; custom entries can be added, edited, or deactivated.
          </p>
        </motion.div>
        {CLINICAL_CATALOGS.map((cat) => (
          <CatalogAdminPanel key={cat.key} catalogKey={cat.key} catalogLabel={cat.label} />
        ))}
      </motion.div>
    </DashboardLayout>
  );
}
