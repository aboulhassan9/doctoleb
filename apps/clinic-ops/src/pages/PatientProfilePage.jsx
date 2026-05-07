import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '@/services/patients';
import { precheckService } from '@/services/prechecks';
import { clinicalService } from '@/services/clinical';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useBrand } from '@/contexts/BrandContext';
import { stagger, fadeUp } from '@/lib/animations';
import { escapeHtml } from '@/lib/html';

export default function PatientProfilePage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { displayName } = useBrand();
    const printableBrandName = escapeHtml(displayName);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showMedicationModal, setShowMedicationModal] = useState(false);
    const [medicationForm, setMedicationForm] = useState({
        search: '',
        dosage: '',
        frequency: 'once-daily',
        duration: '',
        instructions: ''
    });
    const [medications, setMedications] = useState([]);
    const [vitals, setVitals] = useState([]);
    const [allergiesText, setAllergiesText] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');
    const [latestPrecheck, setLatestPrecheck] = useState(null);

    const [patientData, setPatientData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        const fetchAll = async () => {
            try {
                setLoading(true);
                const { data, error } = await patientService.getById(id);
                if (!data || error) {
                    setPatientData(null);
                    setLoadError('This patient record could not be loaded.');
                    return;
                }
                const age = data.date_of_birth
                    ? Math.floor((Date.now() - new Date(data.date_of_birth).getTime()) / 31557600000)
                    : 'N/A';
                setPatientData({
                    id: data.id,
                    name: `${data.users?.first_name || ''} ${data.users?.last_name || ''}`.trim() || 'Unknown',
                    initials: data.users?.initials || '??',
                    age,
                    sex: data.sex || 'N/A',
                    bloodType: data.blood_type || 'N/A',
                    status: 'Active',
                    color: 'bg-primary/10 text-primary',
                });
                setAllergiesText(data.allergies || '');
                setMedicalHistory(data.medical_history || '');

                // Fetch latest vitals from precheck_forms
                const { data: prechecks } = await precheckService.getByPatientId(data.id);
                if (prechecks?.length) {
                    const latest = prechecks[0];
                    setLatestPrecheck(latest);
                    const v = [
                        latest.blood_pressure && { label: 'Blood Pressure', value: latest.blood_pressure, unit: 'mmHg', icon: 'blood_pressure', color: 'text-primary' },
                        latest.temperature && { label: 'Temperature', value: String(latest.temperature), unit: '°C', icon: 'thermometer', color: 'text-orange-500' },
                        latest.heart_rate && { label: 'Heart Rate', value: String(latest.heart_rate), unit: 'bpm', icon: 'favorite', color: 'text-critical' },
                        latest.weight && { label: 'Weight', value: String(latest.weight), unit: 'kg', icon: 'weight', color: 'text-success' },
                        latest.height && { label: 'Height', value: String(latest.height), unit: 'cm', icon: 'straighten', color: 'text-slate-400' },
                    ].filter(Boolean);
                    setVitals(v);
                }

                // Fetch medications from canonical prescriptions.
                const { data: prescriptions } = await clinicalService.getPrescriptions(data.id, { status: 'active', pageSize: 50 });
                if (prescriptions?.length) {
                    setMedications(prescriptions.map((prescription) => ({
                        name: prescription.medication_name || 'Unknown',
                        dose: [prescription.dosage, prescription.frequency, prescription.duration].filter(Boolean).join(' • ') || 'N/A',
                        prescribed: prescription.created_at ? new Date(prescription.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                    })));
                }
            } catch (err) {
                logError('PatientProfilePage fetch error:', err);
                setPatientData(null);
                setLoadError('This patient record could not be loaded.');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!patientData) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg-base)] px-6">
                <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <span className="material-symbols-outlined text-3xl">person_off</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Patient Not Available</h1>
                    <p className="text-sm text-slate-500 mb-6">{loadError || 'This patient record could not be loaded.'}</p>
                    <button onClick={() => navigate('/predoctor-patients')} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all">
                        Back to Patients
                    </button>
                </div>
            </div>
        );
    }

    const patient = patientData;
    const patientColor = patient.color || 'bg-primary/10 text-primary';

    return (
    <SidebarProvider>
        <DashboardLayout role="pre_doctor">
            <div className="flex-1 flex flex-col overflow-y-auto">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search patients, records, or files..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50 transition-all relative z-10"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 relative">
                        <button onClick={() => { setShowNotifications(!showNotifications); setShowSettings(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <button onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-all">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 p-8 overflow-y-auto">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-6 mb-8 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 items-start">
                        <div className="relative">
                            <div className={`w-32 h-32 rounded-2xl shadow-md flex items-center justify-center ${patientColor}`}>
                                <span className="text-4xl font-black">{patient.initials}</span>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white w-6 h-6 rounded-full"></div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-slate-900">{patient.name}</h1>
                                <span className="px-2 py-1 bg-primary/5 text-primary text-[10px] font-bold uppercase rounded tracking-widest">Active</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 mt-4">
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient ID</p><p className="text-sm font-semibold text-slate-700">#{String(patient.id).slice(0,8)}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age / Sex</p><p className="text-sm font-semibold text-slate-700">{patient.age} / {patient.sex}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Type</p><p className="text-sm font-semibold text-critical">{patient.bloodType}</p></div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/predoctor-new-check')} className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:opacity-90 transition-all">Start Pre-Check</button>
                            <button onClick={() => {
                            const printContent = `
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <title>Patient Record - ${patient.name}</title>
                                    <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1e293b; }
                                        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0d6cf2; }
                                        .logo { display: flex; align-items: center; gap: 12px; }
                                        .logo-icon { width: 40px; height: 40px; background: #0d6cf2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
                                        .logo-text h1 { font-size: 18px; font-weight: 800; color: #0f172a; }
                                        .logo-text p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                                        .record-info { text-align: right; }
                                        .record-info .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                                        .record-info .value { font-size: 14px; font-weight: 600; }
                                        .patient-header { display: flex; gap: 24px; margin-bottom: 30px; }
                                        .patient-avatar { width: 80px; height: 80px; background: #dbeafe; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #0d6cf2; }
                                        .patient-details { flex: 1; }
                                        .patient-name { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
                                        .status-badge { display: inline-block; padding: 4px 8px; background: #dbeafe; color: #0d6cf2; font-size: 10px; font-weight: 700; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
                                        .patient-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
                                        .patient-grid div { background: #f8fafc; padding: 12px; border-radius: 8px; }
                                        .patient-grid .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
                                        .patient-grid .value { font-size: 14px; font-weight: 600; }
                                        .section { margin-bottom: 24px; }
                                        .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
                                        .vitals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
                                        .vital-card { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
                                        .vital-card .icon { font-size: 20px; margin-bottom: 8px; }
                                        .vital-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; }
                                        .vital-card .value { font-size: 18px; font-weight: 700; }
                                        .history-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
                                        .history-card { background: #f8fafc; padding: 16px; border-radius: 8px; }
                                        .history-card h4 { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
                                        .history-card .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                                        .history-card .item:last-child { border: none; }
                                        .allergy { background: #fef2f2; border: 1px solid #fecaca; }
                                        .allergy h4 { color: #dc2626 !important; }
                                        .condition { background: #dbeafe; border: 1px solid #bfdbfe; }
                                        .condition h4 { color: #0d6cf2 !important; }
                                        .medications { margin-top: 24px; }
                                        .med-row { display: flex; justify-content: space-between; padding: 12px; background: #f8fafc; margin-bottom: 8px; border-radius: 8px; }
                                        .med-name { font-weight: 600; }
                                        .med-dose { font-size: 12px; color: #64748b; }
                                        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #64748b; }
                                        @media print { body { padding: 20px; } }
                                    </style>
                                </head>
                                <body>
                                    <div class="header">
                                        <div class="logo">
                                            <div class="logo-icon">⚕</div>
                                            <div class="logo-text">
                                                <h1>${printableBrandName}</h1>
                                                <p>Medical Records</p>
                                            </div>
                                        </div>
                                        <div class="record-info">
                                            <div class="label">Date</div>
                                            <div class="value">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                        </div>
                                    </div>
                                    <div class="patient-header">
                                        <div class="patient-avatar">${patient.initials}</div>
                                        <div class="patient-details">
                                            <div class="patient-name">${patient.name}</div>
                                            <span class="status-badge">Active</span>
                                        </div>
                                    </div>
                                    <div class="patient-grid">
                                        <div><div class="label">Patient ID</div><div class="value">#${String(patient.id).slice(0,8)}</div></div>
                                        <div><div class="label">Age / Sex</div><div class="value">${patient.age} / ${patient.sex}</div></div>
                                        <div><div class="label">Blood Type</div><div class="value" style="color: #dc2626;">${patient.bloodType}</div></div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Current Vitals</div>
                                        <div class="vitals-grid">
                                            ${vitals.map(v => `<div class="vital-card"><div class="label">${v.label}</div><div class="value">${v.value} ${v.unit}</div></div>`).join('') || '<div class="vital-card"><div class="value">No vitals recorded</div></div>'}
                                        </div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Medical History</div>
                                        <div class="history-grid">
                                            <div class="history-card allergy">
                                                <h4>⚠️ Allergies</h4>
                                                <div class="item"><span>${allergiesText || 'None recorded'}</span></div>
                                            </div>
                                            <div class="history-card">
                                                <h4>🏥 Medical History</h4>
                                                <div class="item"><span>${medicalHistory || 'None recorded'}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="section medications">
                                        <div class="section-title">Current Medications</div>
                                        ${medications.map(med => `<div class="med-row"><div><div class="med-name">${med.name}</div><div class="med-dose">${med.dose}</div></div><div style="text-align:right;font-size:12px;color:#64748b;">${med.prescribed}</div></div>`).join('')}
                                    </div>
                                    <div class="footer">
                                        <p>This is a computer-generated medical record. ${printableBrandName} • Generated on ${new Date().toLocaleString()}</p>
                                    </div>
                                </body>
                                </html>
                            `;
                            const printWindow = window.open('', '_blank');
                            printWindow.document.write(printContent);
                            printWindow.document.close();
                            printWindow.print();
                        }} className="px-6 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">Print Records</button>
                        </div>
                    </motion.div>

                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="text-xl font-bold text-slate-900">Current Vitals</h2>
                            {latestPrecheck && <span className="text-[10px] font-bold text-slate-400 uppercase">From pre-check: {new Date(latestPrecheck.created_at).toLocaleDateString()}</span>}
                        </div>
                        {vitals.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {vitals.map((vital, i) => (
                                <motion.div key={i} variants={fadeUp} className="bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                                    <span className={`material-symbols-outlined mb-3 text-2xl ${vital.color}`}>{vital.icon}</span>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{vital.label}</p>
                                    <p className="text-xl font-black text-slate-900">{vital.value}<span className="text-xs font-medium text-slate-400 ml-1">{vital.unit}</span></p>
                                </motion.div>
                            ))}
                        </div>
                        ) : (
                        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
                            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">vitals</span>
                            <p className="text-sm text-slate-400">No vitals recorded yet. Start a pre-check to capture vitals.</p>
                        </div>
                        )}
                    </motion.section>

                    <motion.section variants={stagger} initial="hidden" animate="visible" className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm mb-8">
                        <div className="p-6 border-b border-slate-50"><h2 className="text-xl font-bold text-slate-900">Comprehensive Medical History</h2></div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-[10px] font-bold text-critical uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-red-500 rounded-full"></span>Allergies</h3>
                                    {allergiesText ? (
                                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                                        <p className="text-sm font-bold text-critical whitespace-pre-wrap">{allergiesText}</p>
                                    </div>
                                    ) : (
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                        <p className="text-sm text-slate-400">No allergies recorded</p>
                                    </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-primary rounded-full"></span>Medical History</h3>
                                {medicalHistory ? (
                                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{medicalHistory}</p>
                                </div>
                                ) : (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                    <p className="text-sm text-slate-400">No medical history recorded</p>
                                </div>
                                )}
                            </div>
                        </div>
                    </motion.section>

                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900">Current Medications</h2>
                            <button onClick={() => setShowMedicationModal(true)} className="text-primary text-xs font-bold uppercase tracking-widest hover:underline">+ Add New Medication</button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {medications.length > 0 ? medications.map((med, i) => (
                                <div key={i} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">pill</span>
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-slate-900">{med.name}</p>
                                            <p className="text-xs font-medium text-slate-500">{med.dose}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prescribed</p>
                                            <p className="text-xs font-bold text-slate-700">{med.prescribed}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-300 cursor-pointer hover:text-slate-500">more_vert</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-8 text-center">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">medication</span>
                                    <p className="text-sm text-slate-400">No medications prescribed yet</p>
                                </div>
                            )}
                        </div>
                    </motion.section>

                    <AnimatePresence>
                        {showMedicationModal && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowMedicationModal(false)}></div>
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
                                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-slate-900">Add New Medication</h3>
                                        <button onClick={() => setShowMedicationModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-slate-400">close</span>
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Search Medication</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                                <input value={medicationForm.search} onChange={(e) => setMedicationForm({ ...medicationForm, search: e.target.value })} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="e.g. Amoxicillin, Lisinopril..." type="text" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Dosage</label>
                                                <input value={medicationForm.dosage} onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="e.g. 500mg" type="text" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Frequency</label>
                                                <select value={medicationForm.frequency} onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none">
                                                    <option value="once-daily">Once Daily</option>
                                                    <option value="twice-daily">Twice Daily</option>
                                                    <option value="every-evening">Every Evening</option>
                                                    <option value="as-needed">As needed</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Duration / Period</label>
                                            <input value={medicationForm.duration} onChange={(e) => setMedicationForm({ ...medicationForm, duration: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="e.g. 10 days, Ongoing" type="text" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Instructions</label>
                                            <textarea value={medicationForm.instructions} onChange={(e) => setMedicationForm({ ...medicationForm, instructions: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none" placeholder="Special directions (e.g. Take with food)" rows="3" />
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                        <button onClick={() => setShowMedicationModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors">Cancel</button>
                                        <button onClick={() => {
                                            if (medicationForm.search && medicationForm.dosage) {
                                                const frequencyLabels = { 'once-daily': 'Once Daily', 'twice-daily': 'Twice Daily', 'every-evening': 'Every Evening', 'as-needed': 'As needed' };
                                                setMedications([...medications, {
                                                    name: medicationForm.search,
                                                    dose: `${medicationForm.dosage} • ${frequencyLabels[medicationForm.frequency]}${medicationForm.duration ? ' • ' + medicationForm.duration : ''}`,
                                                    prescribed: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                }]);
                                                setShowMedicationModal(false);
                                                setMedicationForm({ search: '', dosage: '', frequency: 'once-daily', duration: '', instructions: '' });
                                            }
                                        }} className="px-6 py-2.5 text-sm font-bold text-white bg-primary hover:text-primary rounded-lg shadow-md shadow-primary/20 transition-all active:scale-[0.98]">Add Medication</button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </DashboardLayout>
    </SidebarProvider>
    );
}
