import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { PageHeader, DataTable, TopBar, StatusBadge } from '@/components/ui';
import { useBrand } from '@/contexts/BrandContext';
import { usePatients, useSearch, useDocumentTitle } from '@/hooks';

/**
 * DoctorPatientsPage — Uses DashboardLayout + TopBar.
 * Page only contains business logic and column definitions.
 */
export default function DoctorPatientsPage() {
  const navigate = useNavigate();
  const { displayName } = useBrand();
  useDocumentTitle('Patients', displayName);

  const { patients, loading, error, refresh } = usePatients();
  const { query, setQuery } = useSearch(200);

  const filtered = patients.filter(p => {
    const name = `${p.users?.first_name || ''} ${p.users?.last_name || ''}`.toLowerCase();
    return name.includes(query.toLowerCase()) || (p.id || '').toLowerCase().includes(query.toLowerCase());
  });

  const columns = [
    {
      key: 'patient',
      label: 'Patient',
      render: (row) => {
        const first = row.users?.first_name || '';
        const last = row.users?.last_name || '';
        const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm bg-primary/10 text-primary">
              {initials || '?'}
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">{`${first} ${last}`.trim()}</p>
              <p className="text-xs text-slate-500 font-mono">{row.id}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'age',
      label: 'Age / Sex',
      render: (row) => {
        const age = row.date_of_birth
          ? new Date().getFullYear() - new Date(row.date_of_birth).getFullYear()
          : 'N/A';
        return <span className="text-sm text-slate-600">{age} / {row.sex || 'N/A'}</span>;
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row) => <span className="text-sm text-slate-600">{row.users?.phone || 'N/A'}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => <span className="text-sm text-slate-600">{row.users?.email || 'N/A'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <StatusBadge status="active" size="sm" />,
    },
    {
      key: 'actions',
      label: 'Action',
      className: 'text-right',
      render: (row) => (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => { e.stopPropagation(); navigate(`/doctor-patient/${row.id}`); }}
          className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
        >
          View Profile
        </motion.button>
      ),
    },
  ];

  return (
    <DashboardLayout role="doctor">
      <TopBar
        onSearch={setQuery}
        searchValue={query}
        searchPlaceholder="Search patients by name or ID..."
      />

      <div className="flex-1 overflow-y-auto p-8 pb-12">
        <PageHeader
          title="Patient List"
          subtitle="Manage and view all registered patients."
          actions={
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg hover:bg-primary/90 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Patient
            </motion.button>
          }
        />

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          error={error}
          onRetry={refresh}
          emptyMessage="No patients found"
          emptyIcon="person_search"
          onRowClick={(row) => navigate(`/doctor-patient/${row.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}