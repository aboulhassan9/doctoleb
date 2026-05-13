/**
 * PatientsPage — orchestrator for the patient management view.
 *
 * Composes: PatientTable, RegisterPatientModal, ViewPatientModal,
 * EditPatientModal, PatientStatsFooter.
 */
import { logError } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useToast } from '@/contexts/ToastContext';
import { getErrorMessage } from '@/lib/errors';
import { patientService } from '@/services/patients';
import { usePatients } from '@/hooks/features/usePatients';

import PatientTable from '@clinic-ops/components/patients/PatientTable';
import PatientStatsFooter from '@clinic-ops/components/patients/PatientStatsFooter';
import RegisterPatientModal from '@clinic-ops/components/patients/RegisterPatientModal';
import ViewPatientModal from '@clinic-ops/components/patients/ViewPatientModal';
import EditPatientModal from '@clinic-ops/components/patients/EditPatientModal';

/* ── Avatar color palette ── */
const COLORS = [
    'bg-primary/10 text-primary', 'bg-secondary/10 text-secondary',
    'bg-success/10 text-success', 'bg-orange-100 text-orange-700',
    'bg-sky-100 text-sky-700', 'bg-critical/10 text-critical',
];

export default function PatientsPage() {
    const [showModal,      setShowModal]      = useState(false);
    const [viewingPatient, setViewingPatient] = useState(null);
    const [editingPatient, setEditingPatient] = useState(null);
    const [patientList,    setPatientList]    = useState([]);

    const { patients, loading, refresh: fetchPatients } = usePatients();
    const { showToast } = useToast();
    const location = useLocation();

    /* Open register modal if directed by navigation state */
    useEffect(() => {
        if (location.state?.openAddModal) {
            setShowModal(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    /* Map raw patient records into display-ready objects */
    useEffect(() => {
        if (!patients) return;
        setPatientList(patients.map((p, i) => {
            const first = p.users?.first_name || '';
            const last  = p.users?.last_name || '';
            const name  = `${first} ${last}`.trim() || 'Unknown';
            return {
                id:       p.id,
                dbId:     p.id,
                name,
                initials: ((first[0] || '') + (last[0] || '')).toUpperCase(),
                color:    COLORS[i % COLORS.length],
                phone:    p.users?.phone || '—',
                visit:    new Date(p.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                raw:      p,
            };
        }));
    }, [patients]);

    /* ── Handlers ── */
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to remove this patient?')) return;
        try {
            setPatientList(prev => prev.filter(p => p.id !== id));
            showToast('Patient record archived', 'success');
            await patientService.delete(id);
        } catch (err) {
            logError('Failed to delete patient:', err);
            showToast('Failed to delete patient', 'error');
            fetchPatients();
        }
    };

    const handleEditSave = async (id, newName, newPhone) => {
        const patient = patientList.find(p => p.id === id);
        const userId  = patient?.raw?.user_id;
        if (!userId) { showToast('Cannot identify patient record', 'error'); return; }

        const parts     = newName.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName  = parts.length > 1 ? parts.slice(1).join(' ') : '';
        const initials  = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();

        setPatientList(prev => prev.map(p => p.id === id ? { ...p, name: newName, phone: newPhone, initials } : p));
        setEditingPatient(null);

        const { error } = await patientService.updateUserInfo(userId, { firstName, lastName, phone: newPhone });
        if (error) { showToast('Failed to update patient', 'error'); fetchPatients(); }
        else       { showToast('Patient updated successfully', 'success'); }
    };

    const handleSave = async (form) => {
        const { data, error } = await patientService.createWalkIn({
            full_name: form.fullName, phone: form.phone || null,
            email: form.email || null, date_of_birth: form.dob || null,
        });
        if (error) { showToast(getErrorMessage(error, 'Failed to create patient'), 'error'); return { error }; }
        await fetchPatients();
        return { id: data.id };
    };

    return (
        <DashboardLayout role="secretary">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Page header */}
                <header className="h-[68px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">person_search</span>
                        <h2 className="text-slate-900 text-lg font-semibold tracking-tight">Patient Management</h2>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Register New Patient
                    </motion.button>
                </header>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-6xl mx-auto flex flex-col gap-6">
                        <PatientTable
                            patientList={patientList}
                            loading={loading}
                            onView={setViewingPatient}
                            onEdit={setEditingPatient}
                            onDelete={handleDelete}
                            onOpenRegister={() => setShowModal(true)}
                        />
                        <PatientStatsFooter patientList={patientList} />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showModal && <RegisterPatientModal onClose={() => setShowModal(false)} onSave={handleSave} />}
            </AnimatePresence>
            <AnimatePresence>
                {viewingPatient && <ViewPatientModal patient={viewingPatient} onClose={() => setViewingPatient(null)} />}
            </AnimatePresence>
            <AnimatePresence>
                {editingPatient && <EditPatientModal patient={editingPatient} onClose={() => setEditingPatient(null)} onSave={handleEditSave} />}
            </AnimatePresence>
        </DashboardLayout>
    );
}
