import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../services/patients';


const sidebarMenu = [
    { icon: 'dashboard', label: 'Dashboard', path: '/predoctor-dashboard', active: false },
    { icon: 'group', label: 'Patients', path: '/predoctor-patients', active: true },
    { icon: 'fact_check', label: 'Pre-Check', path: '/predoctor-new-check', active: false },
    { icon: 'calendar_today', label: 'Appointments', path: '/predoctor-appointments', active: false },
    { icon: 'notifications', label: 'Notifications', path: '/predoctor-notifications', active: false },
];

const patientsData = {
    'CP-1001': { name: 'Sarah Miller', initials: 'SM', age: 32, sex: 'Female', bloodType: 'O+', occupation: 'Software Engineer', status: 'Active', color: 'bg-primary/10 text-primary' },
    'CP-1002': { name: 'James Wilson', initials: 'JW', age: 45, sex: 'Male', bloodType: 'A+', occupation: 'Business Analyst', status: 'Active', color: 'bg-warning/10 text-warning' },
    'CP-1003': { name: 'Robert King', initials: 'RK', age: 58, sex: 'Male', bloodType: 'B+', occupation: 'Retired', status: 'Active', color: 'bg-primary/10 text-primary' },
    'CP-1004': { name: 'Emily Chen', initials: 'EC', age: 28, sex: 'Female', bloodType: 'AB-', occupation: 'Graphic Designer', status: 'Active', color: 'bg-success/10 text-success' },
    'CP-1005': { name: 'Michael Brown', initials: 'MB', age: 52, sex: 'Male', bloodType: 'O-', occupation: 'Engineer', status: 'Active', color: 'bg-secondary/10 text-secondary' },
};

const PATIENT_DATA = {
    'CP-1001': { name: 'Sarah Miller', id: 'CP-1001', age: 32, sex: 'Female', bloodType: 'O+', occupation: 'Software Engineer', status: 'Active' },
    'CP-1002': { name: 'James Wilson', id: 'CP-1002', age: 45, sex: 'Male', bloodType: 'A+', occupation: 'Business Analyst', status: 'Active' },
    'CP-1003': { name: 'Robert King', id: 'CP-1003', age: 58, sex: 'Male', bloodType: 'B+', occupation: 'Retired', status: 'Active' },
    'CP-1004': { name: 'Emily Chen', id: 'CP-1004', age: 28, sex: 'Female', bloodType: 'AB-', occupation: 'Graphic Designer', status: 'Active' },
    'CP-1005': { name: 'Michael Brown', id: 'CP-1005', age: 52, sex: 'Male', bloodType: 'O-', occupation: 'Engineer', status: 'Active' },
};

const VITALS = [
    { label: 'Blood Pressure', value: '120/80', unit: 'mmHg', icon: 'blood_pressure', color: 'text-primary' },
    { label: 'Temperature', value: '36.8', unit: '°C', icon: 'thermometer', color: 'text-orange-500' },
    { label: 'Heart Rate', value: '72', unit: 'bpm', icon: 'favorite', color: 'text-critical' },
    { label: 'Resp. Rate', value: '16', unit: 'br/m', icon: 'air', color: 'text-blue-400' },
    { label: 'Weight', value: '65', unit: 'kg', icon: 'weight', color: 'text-success' },
    { label: 'Height', value: '168', unit: 'cm', icon: 'straighten', color: 'text-slate-400' },
];

const ALLERGIES = [{ name: 'Penicillin', severity: 'Severe Reaction - Anaphylaxis Risk' }];
const CONDITIONS = [{ name: 'Type 2 Diabetes', status: 'Managed - Metformin 500mg BID' }];
const FAMILY_HISTORY = [{ condition: 'Hypertension', relation: 'Father' }, { condition: 'Breast Cancer', relation: 'Maternal Aunt' }];
const SURGICAL_HISTORY = [{ procedure: 'Appendectomy', year: '2015' }, { procedure: 'Wisdom Teeth Extraction', year: '2008' }];
const VACCINES = [{ name: 'COVID-19 (Pfizer)', date: 'Completed 2022' }, { name: 'Influenza (Quad)', date: 'OCT 2023' }, { name: 'MMR', date: 'Up to date' }, { name: 'Tetanus (Tdap)', date: '2019' }];
const INITIAL_MEDICATIONS = [
    { name: 'Metformin', dose: '500mg Tablet • Twice Daily', prescribed: 'Aug 24, 2023' },
    { name: 'Lisinopril', dose: '10mg Tablet • Every Evening', prescribed: 'Aug 24, 2023' },
    { name: 'Ibuprofen', dose: '400mg Tablet • As needed for pain', prescribed: 'Ongoing' },
];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function PatientProfilePage() {
    const navigate = useNavigate();
    const { id } = useParams();
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
    const [medications, setMedications] = useState(INITIAL_MEDICATIONS);

    const [patientData, setPatientData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPatient = async () => {
            try {
                setLoading(true);
                // Attempt to fetch real data
                const { data, error } = await patientService.getById(id);
                if (data && !error) {
                    const age = data.date_of_birth ? new Date().getFullYear() - new Date(data.date_of_birth).getFullYear() : 'N/A';
                    setPatientData({
                        id: data.id,
                        name: `${data.users?.first_name || ''} ${data.users?.last_name || ''}`.trim(),
                        initials: data.users?.initials || '??',
                        age: age,
                        sex: data.sex || 'N/A',
                        bloodType: data.blood_type || 'N/A',
                        occupation: data.occupation || 'Unknown',
                        status: 'Active',
                        color: 'bg-primary/10 text-primary'
                    });
                } else {
                    // Fallback to mock data for demo compatibility if ID doesn't exist in DB
                    setPatientData(PATIENT_DATA[id] || PATIENT_DATA['CP-1001']);
                }
            } catch (err) {
                console.error(err);
                setPatientData(PATIENT_DATA[id] || PATIENT_DATA['CP-1001']);
            } finally {
                setLoading(false);
            }
        };
        fetchPatient();
    }, [id]);

    const patient = patientData || PATIENT_DATA['CP-1001'];
    const patientColor = patient.color || 'bg-primary/10 text-primary';

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#f5f7f8]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden font-display bg-background-light">
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen">
                <div className="p-6 flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-primary text-3xl">medical_services</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900 leading-tight">SmartClinic</h1>
                        <p className="text-xs text-slate-500">Pre-Doctor Module</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    {sidebarMenu.map((item, i) => (
                        <motion.button
                            key={i}
                            onClick={() => item.path && navigate(item.path)}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                                item.active
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                            <span>{item.label}</span>
                        </motion.button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-slate-50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm shrink-0">
                            AT
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-900 truncate">Dr. Aris Thorne</p>
                            <p className="text-xs text-slate-500 truncate">Pre-Doctor</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/login')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-critical hover:bg-red-50 transition-colors font-medium text-sm">
                        <span className="material-symbols-outlined text-[22px]">logout</span>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-y-auto">
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
                                <span className="text-4xl font-black">{patient.initials || (patientsData[id]?.initials || 'SM')}</span>
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-green-500 border-4 border-white w-6 h-6 rounded-full"></div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-slate-900">{patient.name}</h1>
                                <span className="px-2 py-1 bg-primary/5 text-primary text-[10px] font-bold uppercase rounded tracking-widest">Active</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 mt-4">
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient ID</p><p className="text-sm font-semibold text-slate-700">#{patient.id}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age / Sex</p><p className="text-sm font-semibold text-slate-700">{patient.age} / {patient.sex}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Blood Type</p><p className="text-sm font-semibold text-critical">{patient.bloodType}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Occupation</p><p className="text-sm font-semibold text-slate-700">{patient.occupation}</p></div>
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
                                                <h1>SmartClinic</h1>
                                                <p>Medical Records</p>
                                            </div>
                                        </div>
                                        <div class="record-info">
                                            <div class="label">Date</div>
                                            <div class="value">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                        </div>
                                    </div>
                                    <div class="patient-header">
                                        <div class="patient-avatar">${patientsData[id]?.initials || 'SM'}</div>
                                        <div class="patient-details">
                                            <div class="patient-name">${patient.name}</div>
                                            <span class="status-badge">Active</span>
                                        </div>
                                    </div>
                                    <div class="patient-grid">
                                        <div><div class="label">Patient ID</div><div class="value">#${patient.id}</div></div>
                                        <div><div class="label">Age / Sex</div><div class="value">${patient.age} / ${patient.sex}</div></div>
                                        <div><div class="label">Blood Type</div><div class="value" style="color: #dc2626;">${patient.bloodType}</div></div>
                                        <div><div class="label">Occupation</div><div class="value">${patient.occupation}</div></div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Current Vitals</div>
                                        <div class="vitals-grid">
                                            <div class="vital-card"><div class="icon">💓</div><div class="label">Blood Pressure</div><div class="value">120/80 mmHg</div></div>
                                            <div class="vital-card"><div class="icon">🌡️</div><div class="label">Temperature</div><div class="value">36.8°C</div></div>
                                            <div class="vital-card"><div class="icon">❤️</div><div class="label">Heart Rate</div><div class="value">72 bpm</div></div>
                                            <div class="vital-card"><div class="icon">🫁</div><div class="label">Resp. Rate</div><div class="value">16 br/m</div></div>
                                            <div class="vital-card"><div class="icon">⚖️</div><div class="label">Weight</div><div class="value">65 kg</div></div>
                                            <div class="vital-card"><div class="icon">📏</div><div class="label">Height</div><div class="value">168 cm</div></div>
                                        </div>
                                    </div>
                                    <div class="section">
                                        <div class="section-title">Medical History</div>
                                        <div class="history-grid">
                                            <div class="history-card allergy">
                                                <h4>⚠️ Allergies</h4>
                                                <div class="item"><span>Penicillin</span><span>Severe</span></div>
                                            </div>
                                            <div class="history-card condition">
                                                <h4>🏥 Active Conditions</h4>
                                                <div class="item"><span>Type 2 Diabetes</span><span>Managed</span></div>
                                            </div>
                                            <div class="history-card">
                                                <h4>👨‍👩‍👧 Family History</h4>
                                                <div class="item"><span>Hypertension</span><span>Father</span></div>
                                                <div class="item"><span>Breast Cancer</span><span>Maternal Aunt</span></div>
                                            </div>
                                            <div class="history-card">
                                                <h4>🔧 Surgical History</h4>
                                                <div class="item"><span>Appendectomy</span><span>2015</span></div>
                                                <div class="item"><span>Wisdom Teeth</span><span>2008</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="section medications">
                                        <div class="section-title">Current Medications</div>
                                        ${medications.map(med => `<div class="med-row"><div><div class="med-name">${med.name}</div><div class="med-dose">${med.dose}</div></div><div style="text-align:right;font-size:12px;color:#64748b;">${med.prescribed}</div></div>`).join('')}
                                    </div>
                                    <div class="footer">
                                        <p>This is a computer-generated medical record. SmartClinic • Generated on ${new Date().toLocaleString()}</p>
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
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Last updated: Today, 09:45 AM</span>
                        </div>
                        <div className="grid grid-cols-6 gap-4">
                            {VITALS.map((vital, i) => (
                                <motion.div key={i} variants={fadeUp} className="bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
                                    <span className={`material-symbols-outlined mb-3 text-2xl ${vital.color}`}>{vital.icon}</span>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{vital.label}</p>
                                    <p className="text-xl font-black text-slate-900">{vital.value}<span className="text-xs font-medium text-slate-400 ml-1">{vital.unit}</span></p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>

                    <motion.section variants={stagger} initial="hidden" animate="visible" className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm mb-8">
                        <div className="p-6 border-b border-slate-50"><h2 className="text-xl font-bold text-slate-900">Comprehensive Medical History</h2></div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-10">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-[10px] font-bold text-critical uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-red-500 rounded-full"></span>Allergies</h3>
                                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                                        <p className="text-sm font-bold text-critical">{ALLERGIES[0].name}</p>
                                        <p className="text-[10px] text-critical/70 mt-1 uppercase font-bold">{ALLERGIES[0].severity}</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-primary rounded-full"></span>Active Conditions</h3>
                                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                                        <p className="text-sm font-bold text-blue-800">{CONDITIONS[0].name}</p>
                                        <p className="text-[10px] text-primary/70 mt-1 uppercase font-bold">{CONDITIONS[0].status}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-[10px] font-bold text-warning uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-warning/100 rounded-full"></span>Family History</h3>
                                    <div className="space-y-3">
                                        {FAMILY_HISTORY.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <p className="text-sm font-medium text-slate-700">{item.condition}</p>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.relation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-slate-400 rounded-full"></span>Surgical History</h3>
                                    <div className="space-y-3">
                                        {SURGICAL_HISTORY.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <p className="text-sm font-medium text-slate-700">{item.procedure}</p>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.year}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold text-success uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-4 bg-success/100 rounded-full"></span>Vaccines & Immunizations</h3>
                                <div className="flex flex-col gap-3">
                                    {VACCINES.map((vac, i) => (
                                        <div key={i} className="px-4 py-3 bg-success/10 text-success rounded-lg border border-success/20 flex justify-between items-center">
                                            <span className="text-xs font-bold">{vac.name}</span>
                                            <span className="text-[10px] font-medium opacity-70">{vac.date}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900">Current Medications</h2>
                            <button onClick={() => setShowMedicationModal(true)} className="text-primary text-xs font-bold uppercase tracking-widest hover:underline">+ Add New Medication</button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {medications.map((med, i) => (
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
                            ))}
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
                                                setMedicationModal(false);
                                                setMedicationForm({ search: '', dosage: '', frequency: 'once-daily', duration: '', instructions: '' });
                                            }
                                        }} className="px-6 py-2.5 text-sm font-bold text-white bg-primary hover:text-primary rounded-lg shadow-md shadow-primary/20 transition-all active:scale-[0.98]">Add Medication</button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}