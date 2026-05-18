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
    const [selectedCertificate, setSelectedCertificate] = useState(null);

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
                        <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewCert(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg">
                            <span className="material-symbols-outlined text-lg">add</span>
                            New Certificate
                        </motion.button>
                    </div>
                </motion.div>

                {/* Certificate list */}
                <CertificateTable certificates={filteredCertificates} onViewCertificate={setSelectedCertificate} />
            </div>

            {selectedCertificate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6" role="dialog" aria-modal="true" aria-label="Certificate details">
                    <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Certificate</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">{selectedCertificate.title || 'Medical Certificate'}</h3>
                            </div>
                            <button type="button" onClick={() => setSelectedCertificate(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close certificate details">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document ID</p>
                                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{selectedCertificate.id}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-100 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedCertificate.status || (selectedCertificate.is_archived ? 'Archived' : 'Active')}</p>
                                </div>
                                <div className="rounded-xl border border-slate-100 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedCertificate.created_at ? new Date(selectedCertificate.created_at).toLocaleDateString() : 'Not recorded'}</p>
                                </div>
                            </div>
                            <p className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-xs font-semibold leading-relaxed text-slate-600">
                                This view is backed by the saved clinical document row. Editing/export actions stay disabled until the document renderer supports certificate artifacts for this record type.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button type="button" onClick={() => setSelectedCertificate(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Close</button>
                        </div>
                    </div>
                </div>
            )}

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
