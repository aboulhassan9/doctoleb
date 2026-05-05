import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notifications';
import { precheckService } from '../services/prechecks';
import PreDoctorSidebar from '../components/PreDoctorSidebar';
import { stagger, fadeUp, formFade } from '../lib/animations';

export default function PreDoctorCheckPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [vitals, setVitals] = useState({ bloodPressure: '', temperature: '', heartRate: '', respiratoryRate: '', weight: '', height: '' });
    const [background, setBackground] = useState({
        occupation: '',
        vaccinationHistory: '',
        medicalHistory: state?.patient?.medical_history || '',
        surgicalHistory: '',
        familyHistory: '',
    });
    const [observations, setObservations] = useState({ symptoms: '', reports: '' });
    const [showAdditionalAllergyInput, setShowAdditionalAllergyInput] = useState(false);
    const [additionalAllergy, setAdditionalAllergy] = useState('');

    const patientInfo = state?.patient?.users;
    const ptId = state?.patient?.id;
    const patientDisplay = {
        name: patientInfo ? `${patientInfo.first_name || ''} ${patientInfo.last_name || ''}`.trim() : 'Unknown Patient',
        initials: patientInfo ? `${(patientInfo.first_name?.[0] || '').toUpperCase()}${(patientInfo.last_name?.[0] || '').toUpperCase()}` : '?',
        id: ptId ? ptId.split('-')[0] : 'N/A',
        age: state?.patient?.date_of_birth ? new Date().getFullYear() - new Date(state.patient.date_of_birth).getFullYear() : 'N/A',
    };
    const patientAllergies = state?.patient?.allergies
        ? state.patient.allergies.split(',').map(a => a.trim()).filter(Boolean)
        : [];
    const combinedAllergies = [...patientAllergies, additionalAllergy.trim()].filter(Boolean).join(', ');

    const handleSubmit = async () => {
        if (!ptId) {
            showToast('No patient selected. Cannot submit pre-check.', 'error');
            return;
        }
        if (!vitals.bloodPressure || !vitals.heartRate || !vitals.temperature) {
            showToast('Blood pressure, heart rate and temperature are required.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const { error } = await precheckService.submit({
                patientId: ptId,
                predoctorId: null,
                bloodPressure: vitals.bloodPressure,
                heartRate: vitals.heartRate,
                temperature: vitals.temperature,
                weight: vitals.weight,
                height: vitals.height,
                currentMedications: background.medicalHistory,
                allergies: combinedAllergies,
                symptoms: observations.symptoms,
                isUrgent: false,
            });

            if (error) throw error;

            await notificationService.notifyRole('doctor', {
                title: 'Pre-Check Complete',
                message: `${patientDisplay.name} has completed pre-check and is ready for consultation.`,
                type: 'precheck',
                related_id: ptId,
            });

            showToast('Pre-check submitted successfully to doctor queue', 'success');
            navigate('/predoctor-success', { state: { patient: { name: patientDisplay.name, id: ptId } } });
        } catch (error) {
            console.error('Failed to submit precheck:', error);
            showToast('Failed to submit pre-check', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!ptId) {
            showToast('No patient selected. Cannot save draft.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await precheckService.saveDraft({
                patientId: ptId,
                predoctorId: null,
                bloodPressure: vitals.bloodPressure,
                heartRate: vitals.heartRate,
                temperature: vitals.temperature,
                weight: vitals.weight,
                height: vitals.height,
                currentMedications: background.medicalHistory,
                allergies: combinedAllergies,
                symptoms: observations.symptoms,
                isUrgent: false,
            });

            if (error) throw new Error(error);
            showToast('Draft saved successfully', 'success');
        } catch (draftError) {
            showToast(draftError.message || 'Failed to save draft', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden font-display bg-background-light">
            <PreDoctorSidebar />

            <main className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search patients, records, or files..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all"><span className="material-symbols-outlined">help</span></button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all"><span className="material-symbols-outlined">settings</span></button>
                    </div>
                </header>

                <div className="p-8 pb-12">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-center justify-between">
                        <div>
                            <nav className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                <span>Patients</span><span className="material-symbols-outlined text-[12px]">chevron_right</span><span className="text-primary">Form</span>
                            </nav>
                            <h1 className="text-3xl font-black text-slate-900">Clinical Pre-Check</h1>
                            <p className="text-slate-500 mt-2 font-medium">Please complete all required fields for the initial triage process.</p>
                        </div>
                        <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                                {patientDisplay.initials}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-slate-900">{patientDisplay.name}</h3>
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full uppercase">Active</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">ID: <span className="text-slate-900">{patientDisplay.id}</span> • Age: <span className="text-slate-900">{patientDisplay.age}</span></p>
                            </div>
                        </motion.div>
                    </motion.div>

                    <div className="space-y-6">
                        <motion.section variants={formFade} initial="hidden" animate="visible" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-xl">vital_signs</span></div>
                                    <h2 className="text-base font-bold text-slate-900">Core Vitals Assessment</h2>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Core Vitals</span>
                            </div>
                            <div className="p-8">
                                <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {[
                                        { label: 'Blood Pressure (mmHg)', icon: 'speed', key: 'bloodPressure', placeholder: 'e.g. 120/80' },
                                        { label: 'Temperature (°C)', icon: 'thermometer', key: 'temperature', placeholder: 'e.g. 36.8' },
                                        { label: 'Heart Rate (BPM)', icon: 'favorite', key: 'heartRate', placeholder: 'e.g. 72' },
                                        { label: 'Respiratory Rate', icon: 'air', key: 'respiratoryRate', placeholder: 'e.g. 16' },
                                        { label: 'Weight (kg)', icon: 'monitor_weight', key: 'weight', placeholder: 'e.g. 68.5' },
                                        { label: 'Height (cm)', icon: 'straighten', key: 'height', placeholder: 'e.g. 168' },
                                    ].map((field, i) => (
                                        <motion.div variants={fadeUp} key={i} className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                <span className="material-symbols-outlined text-base">{field.icon}</span>{field.label}
                                            </label>
                                            <input type="text" value={vitals[field.key]} onChange={(e) => setVitals({ ...vitals, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full border border-slate-200 rounded-xl text-sm font-semibold py-3 focus:border-primary focus:ring-primary/20 bg-slate-50/50" />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        </motion.section>

                        <motion.section variants={formFade} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-xl">person_search</span></div>
                                <h2 className="text-base font-bold text-slate-900">Background & History</h2>
                            </div>
                            <div className="p-8 space-y-8">
                                <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <motion.div variants={fadeUp} className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Occupation/Job</label>
                                        <input type="text" value={background.occupation} onChange={(e) => setBackground({ ...background, occupation: e.target.value })} className="w-full border border-slate-200 rounded-xl text-sm font-medium py-3 focus:border-primary" />
                                    </motion.div>
                                    <motion.div variants={fadeUp} className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Known Allergies</label>
                                        <div className="flex flex-wrap gap-2">
                                            {patientAllergies.length > 0 ? patientAllergies.map((allergy, i) => (
                                                <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-critical/10 text-critical px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase flex items-center gap-2">
                                                    {allergy}
                                                </motion.span>
                                            )) : (
                                                <span className="text-xs text-slate-400 italic">None recorded</span>
                                            )}
                                            <button type="button" onClick={() => setShowAdditionalAllergyInput(true)} className="text-primary text-[10px] font-semibold uppercase flex items-center gap-1 border border-dashed border-primary px-3 py-1.5 rounded-lg hover:bg-primary/5">Add New</button>
                                        </div>
                                        {showAdditionalAllergyInput && (
                                            <input
                                                type="text"
                                                value={additionalAllergy}
                                                onChange={(event) => setAdditionalAllergy(event.target.value)}
                                                placeholder="Add another allergy..."
                                                className="w-full border border-slate-200 rounded-xl text-sm font-medium py-3 focus:border-primary"
                                            />
                                        )}
                                    </motion.div>
                                </motion.div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vaccination History</label>
                                        <textarea value={background.vaccinationHistory} onChange={(e) => setBackground({ ...background, vaccinationHistory: e.target.value })} rows="2" className="w-full border border-slate-200 rounded-xl text-sm font-medium py-3 focus:border-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Medical History</label>
                                        <textarea value={background.medicalHistory} onChange={(e) => setBackground({ ...background, medicalHistory: e.target.value })} rows="2" className="w-full border border-slate-200 rounded-xl text-sm font-medium py-3 focus:border-primary" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Medications</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <p className="text-xs text-slate-400 italic col-span-2">No current medications recorded. Add below if applicable.</p>
                                    </div>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-slate-50 w-full md:w-auto">
                                        <span className="material-symbols-outlined text-slate-400">add_circle</span>
                                        <span className="text-sm font-bold text-slate-500">Add Medication</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.section>

                        <motion.section variants={formFade} initial="hidden" animate="visible" transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-xl">visibility</span></div>
                                <h2 className="text-base font-bold text-slate-900">Clinical Observations & Reports</h2>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Primary Symptoms</label>
                                        <textarea value={observations.symptoms} onChange={(e) => setObservations({ ...observations, symptoms: e.target.value })} placeholder="Describe current symptoms..." rows="4" className="w-full border border-slate-200 rounded-xl text-sm font-medium py-3 focus:border-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pre-Doctor Reports</label>
                                        <textarea value={observations.reports} onChange={(e) => setObservations({ ...observations, reports: e.target.value })} placeholder="Internal notes..." rows="4" className="w-full border border-primary/20 rounded-xl text-sm font-medium py-3 focus:border-primary bg-primary/10" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Diagnostic Report Upload</label>
                                    <motion.label whileHover={{ scale: 1.01 }} className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer">
                                        <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => { if (e.target.files?.[0]) alert(`File: ${e.target.files[0].name}`); }} />
                                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                            <span className="material-symbols-outlined text-slate-400 text-3xl">cloud_upload</span>
                                        </motion.div>
                                        <p className="text-sm font-bold text-slate-700">Drop files here or click to browse</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-semibold mt-2">PDF, JPG, PNG • Max 10MB</p>
                                    </motion.label>
                                </div>
                            </div>
                        </motion.section>
                    </div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-12 flex items-center justify-between pt-8 border-t border-slate-200">
                        <motion.button whileHover={{ x: -5 }} onClick={() => navigate('/predoctor-patients')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm">
                            <span className="material-symbols-outlined text-lg">arrow_back</span>Back to Patient Profile
                        </motion.button>
                        <div className="flex items-center gap-4">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveDraft} className="px-8 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Save as Draft</motion.button>
                            <motion.button disabled={isSaving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit} className="px-12 py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-xl hover:opacity-90 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSaving ? 'Submitting...' : 'Submit to Doctor'}<span className="material-symbols-outlined text-sm">send</span>
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
