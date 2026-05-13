/**
 * DoctorCertificatesPage — Orchestrator for certificate management.
 *
 * Delegates rendering to:
 *   - DashboardHeader (shared sticky header with search/notifications/settings)
 *   - DashboardSettingsModals (shared profile/theme/security modals)
 *   - CertificateTable (certificate list table)
 *   - CertificateFormModal (creation modal with live preview + signature)
 *
 * Reduced from 514 → ~105 lines.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import DashboardHeader from '@clinic-ops/components/dashboard/DashboardHeader';
import DashboardSettingsModals from '@clinic-ops/components/dashboard/DashboardSettingsModals';
import CertificateTable from '@clinic-ops/components/certificates/CertificateTable';
import CertificateFormModal from '@clinic-ops/components/certificates/CertificateFormModal';
import { doctorService } from '@/services/doctors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCertificates } from '@/hooks/features/useCertificates';
import { usePatients } from '@/hooks/features/usePatients';

export default function DoctorCertificatesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [showNewCert, setShowNewCert] = useState(false);
    const [doctorId, setDoctorId] = useState(null);

    // Settings modals state
    const [showProfile, setShowProfile] = useState(false);
    const [showTheme, setShowTheme] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    const { certificates, refresh: refreshCerts } = useCertificates();
    const { patients } = usePatients();
    const { user } = useAuth();
    const { showToast } = useToast();

    // Load doctor profile ID for certificate issuance
    useEffect(() => {
        const fetchDoctorProfile = async () => {
            if (!user?.id) return;
            const { data, error } = await doctorService.getByUserId(user.id);
            if (error) {
                showToast('Doctor profile not found. Certificates cannot be issued yet.', 'error');
                return;
            }
            setDoctorId(data?.id || null);
        };
        fetchDoctorProfile();
    }, [showToast, user?.id]);

    // Filter certificates by search
    const filteredCertificates = certificates.filter(c => {
        const title = c.title || '';
        const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.id && c.id.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filter === 'all' || c.document_type === 'certificate';
        return matchesSearch && matchesFilter;
    });

    return (
        <DashboardLayout role="doctor">
            <DashboardHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onOpenProfile={() => setShowProfile(true)}
                onOpenTheme={() => setShowTheme(true)}
                onOpenSecurity={() => setShowSecurity(true)}
            />

            <div className="flex-1 overflow-y-auto p-8 pb-12">
                {/* Page title + actions */}
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Certificates</h2>
                        <p className="text-slate-500 mt-2 text-base">Manage and generate medical certificates</p>
                    </div>
                    <div className="flex items-center gap-3 mt-4 md:mt-0">
                        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium">
                            <option value="all">All Certificates</option>
                            <option value="Medical Certificate">Medical Certificate</option>
                        </select>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewCert(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg">
                            <span className="material-symbols-outlined text-lg">add</span>
                            New Certificate
                        </motion.button>
                    </div>
                </motion.div>

                {/* Certificate list */}
                <CertificateTable certificates={filteredCertificates} />
            </div>

            {/* Certificate creation modal */}
            <CertificateFormModal
                isOpen={showNewCert}
                onClose={() => setShowNewCert(false)}
                patients={patients}
                doctorId={doctorId}
                onSaved={refreshCerts}
            />

            {/* Settings modals */}
            <DashboardSettingsModals
                showProfile={showProfile}
                showTheme={showTheme}
                showSecurity={showSecurity}
                onCloseProfile={() => setShowProfile(false)}
                onCloseTheme={() => setShowTheme(false)}
                onCloseSecurity={() => setShowSecurity(false)}
            />
        </DashboardLayout>
    );
}
