import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';

/* ═══════════════════════════════════════════════════════════
   Constants & pure utilities
═══════════════════════════════════════════════════════════ */
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];   // matches JS getDay()
const WEEK_DAYS    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];   // Mon-first display order

const HOUR_HEIGHT  = 96;           // pixels per hour in the time-grid views
const START_HOUR   = 8;
const END_HOUR     = 18;
const HOURS        = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const pad   = n  => String(n).padStart(2, '0');
const fmtH  = h  => `${pad(h)}:00`;
const fmtHM = (h, m) => `${pad(h)}:${pad(m)}`;
const same  = (a, b) => a.toDateString() === b.toDateString();
const toDateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Monday of the ISO week that contains `date`
function weekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

// ISO week number
function weekNum(d) {
    const dt  = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const y   = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil(((dt - y) / 86400000 + 1) / 7);
}

// Month-view calendar cells (null = empty padding)
function monthCells(year, month) {
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells = Array(first).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

// JS getDay() (Sun=0) → week column index (Mon=0 … Sun=6)
const toWeekIdx = day => (day === 0 ? 6 : day - 1);

/* ═══════════════════════════════════════════════════════════
   Sample data
═══════════════════════════════════════════════════════════ */
const DEPARTMENTS = [
    'General Consultation', 'Cardiology', 'Pediatrics', 'Neurology', 'Orthopedics', 'Dermatology', 'Ophthalmology', 'Psychiatry'
];

const TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30'
];

import { appointmentService } from '@/services/appointments';
import { useAppointments } from '@/hooks/features/useAppointments';
import { usePatients } from '@/hooks/features/usePatients';
import { patientService } from '@/services/patients';
import { doctorService } from '@/services/doctors';
import { slotService } from '@/services/slots';

/* ═══════════════════════════════════════════════════════════
   Style maps for Week & Day appointment blocks
═══════════════════════════════════════════════════════════ */
const WSM = {   // Week Style Map
    primary: { card:'bg-primary border-transparent shadow-lg shadow-primary/20', time:'text-blue-100',    name:'text-white',     type:'text-blue-100/75'   },
    light:   { card:'bg-white border border-primary/20 shadow-sm',               time:'text-primary',     name:'text-slate-900', type:'text-slate-500'      },
    dark:    { card:'bg-slate-900 border border-slate-700 shadow-lg',             time:'text-slate-400',   name:'text-white',     type:'text-slate-300'      },
    amber:   { card:'bg-warning/10 border-l-4 border-warning',                    time:'text-warning',   name:'text-slate-900', type:'text-warning/80'   },
    indigo:  { card:'bg-indigo-100 border-l-4 border-indigo-500',                 time:'text-indigo-700',  name:'text-indigo-900',type:'text-indigo-600'     },
    emerald: { card:'bg-success/10 border-l-4 border-success',                time:'text-success', name:'text-slate-900', type:'text-success'    },
};

const DSM = {   // Day Style Map
    confirmed: { card:'bg-primary/5 border-l-4 border-blue-600',   time:'text-blue-800',  name:'text-slate-900', type:'text-primary/70',   badge:'bg-primary-hover/10 text-primary'    },
    active:    { card:'bg-primary shadow-md scale-[1.01]',        time:'text-blue-100',  name:'text-white',     type:'text-blue-100/80',   badge:'bg-white/20 text-white'           },
    pending:   { card:'bg-warning/10 border-l-4 border-warning',  time:'text-amber-800', name:'text-slate-900', type:'text-warning/70',  badge:'bg-warning/100/10 text-warning'  },
};

/* ═══════════════════════════════════════════════════════════
   Reusable mini-components
═══════════════════════════════════════════════════════════ */
function IconBtn({ icon, onClick, className = '' }) {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
            onClick={onClick}
            className={`p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors ${className}`}
        >
            <span className="material-symbols-outlined text-slate-600">{icon}</span>
        </motion.button>
    );
}

function SLabel({ children }) {
    return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">{children}</p>;
}

const sInput = 'w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

const PRIORITY_OPTS = [
    { label:'Low',    val:'low',    checked:'bg-success/10 border-success text-success' },
    { label:'Medium', val:'medium', checked:'bg-warning/10  border-warning  text-warning'   },
    { label:'Urgent', val:'urgent', checked:'bg-red-50    border-critical    text-critical'     },
];

const BLANK_APPT = { patient_id:'', department: DEPARTMENTS[0], doctor_id: '', reason:'', time:'', priority:'medium' };

/* ─────────────────────────────────────────────────────────
   Mini-calendar used inside the schedule modal
───────────────────────────────────────────────────────── */
function MiniCalendar({ selected, onSelect }) {
    const now   = new Date();
    const [cy, setCy] = useState(selected ? selected.getFullYear() : now.getFullYear());
    const [cm, setCm] = useState(selected ? selected.getMonth()    : now.getMonth());

    const cells  = monthCells(cy, cm);
    const rows   = cells.length / 7;
    const prevM  = () => cm === 0  ? (setCy(y => y-1), setCm(11)) : setCm(m => m-1);
    const nextM  = () => cm === 11 ? (setCy(y => y+1), setCm(0))  : setCm(m => m+1);
    const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-slate-800">
                    {MONTH_NAMES[cm]} {cy}
                </span>
                <div className="flex gap-1">
                    {[['chevron_left', prevM], ['chevron_right', nextM]].map(([ic, fn], i) => (
                        <button key={i} onClick={fn} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">{ic}</span>
                        </button>
                    ))}
                </div>
            </div>
            {/* Day labels */}
            <div className="grid grid-cols-7 text-center mb-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <span key={i} className="text-[9px] font-black text-slate-400 uppercase">{d}</span>
                ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const d   = new Date(cy, cm, day);
                    const sel = selected && same(d, selected);
                    const tod = same(d, today);
                    const past = d < today;
                    return (
                        <button
                            key={idx}
                            disabled={past}
                            onClick={() => onSelect(d)}
                            className={`h-8 w-full text-xs rounded-lg font-medium transition-colors
                                ${sel  ? 'bg-primary text-white font-black shadow-md shadow-primary/30' : ''}
                                ${!sel && tod  ? 'border border-primary text-primary font-black' : ''}
                                ${!sel && !tod && !past ? 'text-slate-700 hover:bg-primary/5 hover:text-primary' : ''}
                                ${past ? 'text-slate-200 cursor-not-allowed' : ''}
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────
   Quick Add Patient Modal (Sub-modal)
   Centered overlay on top of the scheduler
───────────────────────────────────────────────────────── */
function QuickAddModal({ onClose, onSuccess }) {
    const { showToast } = useToast();
    const [qForm, setQForm] = useState({
        name: '', dob: '', gender: 'Select Gender',
        mobile: '', email: '', insurance: '', policy: ''
    });
    const [qSaving, setQSaving] = useState(false);
    const qId = 'CP-8842-X'; // Simulated auto-id

    const setQ = (k, v) => setQForm(prev => ({ ...prev, [k]: v }));

    const handleRegister = async () => {
        if (!qForm.name || !qForm.mobile) return;
        setQSaving(true);
        const { data, error } = await patientService.createWalkIn({
            full_name: qForm.name,
            phone: qForm.mobile,
            email: qForm.email,
            date_of_birth: qForm.dob,
        });
        setQSaving(false);

        if (error) {
            showToast(getErrorMessage(error, 'Failed to register patient'), 'error');
            return;
        }

        showToast('Patient registered successfully', 'success');
        onSuccess(data);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white">
                    <h2 className="text-xl font-black text-slate-900">Quick Add Patient</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    <p className="text-slate-500 text-sm font-medium">Register a new patient to proceed with the appointment booking.</p>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Patient ID */}
                        <div className="col-span-2 space-y-2">
                            <SLabel>Patient ID (Auto-generated)</SLabel>
                            <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-primary font-black text-sm">
                                {qId}
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="col-span-2 space-y-2">
                            <SLabel>Full Name (First & Last)</SLabel>
                            <input
                                value={qForm.name}
                                onChange={e => setQ('name', e.target.value)}
                                className={sInput}
                                placeholder="e.g. Jonathan Doe"
                            />
                        </div>

                        {/* DOB */}
                        <div className="space-y-2">
                            <SLabel>Date of Birth</SLabel>
                            <input
                                type="date"
                                value={qForm.dob}
                                onChange={e => setQ('dob', e.target.value)}
                                className={sInput}
                            />
                        </div>

                        {/* Gender */}
                        <div className="space-y-2">
                            <SLabel>Gender Selection</SLabel>
                            <select
                                value={qForm.gender}
                                onChange={e => setQ('gender', e.target.value)}
                                className={sInput}
                            >
                                <option>Select Gender</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                            </select>
                        </div>

                        {/* Mobile */}
                        <div className="space-y-2">
                            <SLabel>Mobile Number</SLabel>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] material-symbols-outlined">phone</span>
                                <input
                                    placeholder="+1 (555) 000-0000"
                                    value={qForm.mobile}
                                    onChange={e => setQ('mobile', e.target.value)}
                                    className={sInput + ' pl-10'}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <SLabel>Email Address</SLabel>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] material-symbols-outlined">mail</span>
                                <input
                                    placeholder="patient@example.com"
                                    value={qForm.email}
                                    onChange={e => setQ('email', e.target.value)}
                                    className={sInput + ' pl-10'}
                                />
                            </div>
                        </div>

                        {/* Insurance */}
                        <div className="space-y-2">
                            <SLabel>Insurance Company</SLabel>
                            <input
                                placeholder="e.g. Blue Cross"
                                value={qForm.insurance}
                                onChange={e => setQ('insurance', e.target.value)}
                                className={sInput}
                            />
                        </div>

                        {/* Policy */}
                        <div className="space-y-2">
                            <SLabel>Policy Number</SLabel>
                            <input
                                placeholder="e.g. 123456789"
                                value={qForm.policy}
                                onChange={e => setQ('policy', e.target.value)}
                                className={sInput}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-3 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors">
                        Cancel
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={handleRegister}
                        disabled={qSaving || !qForm.name || !qForm.mobile}
                        className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                        {qSaving ? 'Registering...' : 'Register & Continue to Appointment'}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────
   Schedule Appointment slide-over modal
───────────────────────────────────────────────────────── */
function ScheduleModal({ onClose }) {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [form,         setForm]         = useState(BLANK_APPT);
    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const [selDate,      setSelDate]      = useState(null);
    const [saving,       setSaving]       = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const { patients: patientsList, loading: loadingPatients, refresh: refreshPatients } = usePatients();
    const [doctorsList, setDoctorsList] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [step, setStep] = useState('form');
    const [availableSlots, setAvailableSlots] = useState([]);

    useEffect(() => {
        doctorService.getAll().then(res => setDoctorsList(res.data || []));
    }, []);

    useEffect(() => {
        if (form.doctor_id && selDate) {
            slotService.getAvailableSlots(form.doctor_id, toDateKey(selDate)).then(res => {
                setAvailableSlots(res.data || []);
            });
        } else {
            setAvailableSlots([]);
        }
    }, [form.doctor_id, selDate]);

    const selectedPatientData = patientsList.find(p => p.id === form.patient_id);
    const availableSlotTimes = new Set(availableSlots.map(slot => String(slot.start_time || '').slice(0, 5)));

    useEffect(() => {
        const nextAvailableSlotTimes = new Set(availableSlots.map(slot => String(slot.start_time || '').slice(0, 5)));
        if (form.time && !nextAvailableSlotTimes.has(form.time)) {
            set('time', '');
        }
    }, [availableSlots, form.time]);

    const [isDownloading, setIsDownloading] = useState(false);

    const fmtDate = d => d
        ? d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
        : '—';

    const handleConfirm = async () => {
        if (!form.patient_id || !selDate || !form.time || !form.doctor_id) return;
        if (!user?.id) {
            showToast('Missing active staff session. Please sign in again.', 'error');
            return;
        }

        setSaving(true);

        try {
            const selectedSlot = availableSlots.find(slot => String(slot.start_time || '').slice(0, 5) === form.time);
            if (!selectedSlot?.id) {
                showToast('That slot is no longer available. Please pick another time.', 'error');
                return;
            }

            const result = await appointmentService.bookFromSlot({
                slotId: selectedSlot.id,
                patientId: form.patient_id,
                bookedBy: user.id,
                reason: form.reason || 'General Consultation',
                status: 'scheduled'
            });

            if (result.error) throw result.error;

            showToast('Appointment booked successfully', 'success');
            setStep('success');
        } catch (error) {
            logError('Failed to book appointment:', error);
            showToast('Failed to schedule appointment', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        await new Promise(r => setTimeout(r, 1500));
        setIsDownloading(false);
        showToast("Patient appointment PDF generated and downloaded to your system.", "success");
    };

    const handlePrint = () => {
        window.print();
    };

    const handleModify = () => {
        setStep('form');
    };

    const onQuickAddSuccess = (newPatient) => {
        refreshPatients();
        set('patient_id', newPatient.id);
        setSearchQuery(`${newPatient?.users?.first_name || ''} ${newPatient?.users?.last_name || ''}`.trim());
        setShowQuickAdd(false);
    };


    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex"
            onClick={step === 'form' ? onClose : undefined}
        >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className="relative ml-auto w-full max-w-3xl h-screen bg-background-light shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {/* ═══════ STEP 1: FORM ═══════ */}
                    {step === 'form' && (
                        <motion.div
                            key="appt-form"
                            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.22 }}
                            className="flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Schedule Appointment</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">Configure a new clinical encounter for a patient.</p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </motion.button>
                            </div>

                            {/* Scrollable body — 2-column grid */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="grid grid-cols-12 gap-6">

                                    {/* ── Left col (8/12) ── */}
                                    <div className="col-span-8 space-y-6">

                                        {/* Patient search */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all duration-300">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg">
                                                    <span className="material-symbols-outlined text-primary">person_search</span>
                                                    Patient Information
                                                </h3>
                                                <button
                                                    onClick={() => setShowQuickAdd(true)}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 text-primary text-[10px] font-black hover:bg-primary/5 transition-colors uppercase tracking-wider"
                                                >
                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                    Add New Patient
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {!form.patient_id ? (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                                                        <SLabel>Search Database</SLabel>
                                                        <div className="relative">
                                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                                                            <input
                                                                value={searchQuery}
                                                                onChange={e => setSearchQuery(e.target.value)}
                                                                placeholder="Start typing name, ID or DOB…"
                                                                className={sInput + ' pl-12'}
                                                            />
                                                        </div>
                                                        <div className="mt-2 max-h-40 overflow-y-auto border border-slate-100 rounded-xl">
                                                            {patientsList.filter(p => {
                                                                const n = `${p.users?.first_name || ''} ${p.users?.last_name || ''}`.toLowerCase();
                                                                return n.includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
                                                            }).map(p => (
                                                                <button key={p.id} onClick={() => set('patient_id', p.id)} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm font-bold text-slate-700">
                                                                    {p.users?.first_name} {p.users?.last_name} <span className="text-slate-400 font-normal ml-2">ID: {p.id.split('-')[0]}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        className="space-y-4"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Active Selection</label>
                                                            <button
                                                                onClick={() => set('patient_id', null)}
                                                                className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline"
                                                            >
                                                                Change Patient
                                                            </button>
                                                        </div>

                                                        {/* Selection Preview Card */}
                                                        <div className="p-5 bg-primary/5 rounded-2xl border-2 border-primary/20 flex items-center gap-4 transition-all shadow-sm">
                                                            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-primary/10 shadow-sm shrink-0">
                                                                <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-lg font-black text-slate-900 leading-none truncate">{selectedPatientData?.users?.first_name} {selectedPatientData?.users?.last_name}</p>
                                                                    <span className="material-symbols-outlined text-primary text-xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                                                </div>
                                                                <p className="text-sm text-slate-500 mt-2 font-medium">ID: {selectedPatientData?.id?.split('-')[0]} • DOB: {selectedPatientData?.date_of_birth ? new Date(selectedPatientData.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                <span className="px-2.5 py-1 bg-success/10 text-success text-[9px] font-black uppercase rounded-lg">Verified</span>
                                                                <button
                                                                    onClick={() => set('patient_id', null)}
                                                                    className="p-1 text-slate-300 hover:text-critical transition-colors"
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">close</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Appointment details */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2 mb-5">
                                                <span className="material-symbols-outlined text-primary text-[20px]">clinical_notes</span>
                                                Appointment Details
                                            </h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <SLabel>Department / Service</SLabel>
                                                    <select value={form.department} onChange={e => set('department', e.target.value)} className={sInput}>
                                                        {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <SLabel>Provider (Doctor)</SLabel>
                                                    <select value={form.doctor_id || ''} onChange={e => set('doctor_id', e.target.value)} className={sInput}>
                                                        <option value="">Select Doctor</option>
                                                        {doctorsList.map(d => <option key={d.id} value={d.id}>Dr. {d.users?.first_name} {d.users?.last_name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Reason for visit */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2 mb-5">
                                                <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
                                                Reason for Visit
                                            </h3>
                                            <textarea
                                                rows={4}
                                                value={form.reason}
                                                onChange={e => set('reason', e.target.value)}
                                                placeholder="Briefly describe symptoms, medical history or special instructions…"
                                                className={sInput + ' resize-none'}
                                            />
                                        </div>
                                    </div>

                                    {/* ── Right col (4/12) ── */}
                                    <div className="col-span-4 space-y-6">

                                        {/* Mini calendar */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4 text-sm">
                                                <span className="material-symbols-outlined text-primary text-[18px]">event</span>
                                                Select Date
                                            </h3>
                                            <MiniCalendar selected={selDate} onSelect={setSelDate} />
                                            {selDate && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                                    className="mt-3 px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 text-xs font-bold text-primary text-center"
                                                >
                                                    {selDate.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Time slots */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4 text-sm">
                                                <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                                                Time Slot
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {TIME_SLOTS.map(t => {
                                                    const available = availableSlotTimes.has(t);
                                                    const sel  = form.time === t;
                                                    return (
                                                        <button
                                                            key={t}
                                                            disabled={!available}
                                                            onClick={() => available && set('time', t)}
                                                            className={`py-2.5 px-3 text-[11px] font-bold rounded-xl border transition-all
                                                                ${!available  ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50' : ''}
                                                                ${available && sel  ? 'bg-primary/10 border-2 border-primary text-primary' : ''}
                                                                ${available && !sel ? 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary' : ''}
                                                            `}
                                                        >
                                                            {!available && <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 mr-1 -mb-0.5" />}
                                                            {t}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Priority */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                            <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4 text-sm">
                                                <span className="material-symbols-outlined text-primary text-[18px]">priority_high</span>
                                                Priority
                                            </h3>
                                            <div className="flex gap-2">
                                                {PRIORITY_OPTS.map(({ label, val, checked }) => (
                                                    <button
                                                        key={val}
                                                        onClick={() => set('priority', val)}
                                                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all
                                                            ${form.priority === val ? checked : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}
                                                        `}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-white border-t border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                                <p className="text-xs text-slate-400 font-medium">
                                    {!form.patient_id && 'Select patient · '}
                                    {!selDate      && 'Pick a date · '}
                                    {!form.time    && 'Select a time slot'}
                                    {form.patient_id && selDate && form.time && form.doctor_id && (
                                        <span className="text-success font-bold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                            Ready to confirm
                                        </span>
                                    )}
                                </p>
                                <div className="flex gap-3">
                                    <button onClick={onClose}
                                        className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={handleConfirm}
                                        disabled={saving || !form.patient_id || !selDate || !form.time || !form.doctor_id}
                                        className="px-8 py-2.5 bg-primary disabled:opacity-50 hover:bg-primary/90 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all min-w-[170px] justify-center"
                                    >
                                        {saving ? (
                                            <>
                                                <motion.span
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
                                                    className="material-symbols-outlined text-[18px]"
                                                >
                                                    progress_activity
                                                </motion.span>
                                                Scheduling…
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
                                                Confirm Appointment
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ═══════ STEP 2: SUCCESS ═══════ */}
                    {step === 'success' && (
                        <motion.div
                            key="appt-success"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col h-full"
                        >
                            {/* Header */}
                            <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Appointment Confirmation</h2>
                                </div>
                                <motion.button whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }} onClick={onClose}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </motion.button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-50/50 flex flex-col items-center">
                                <div className="max-w-2xl w-full">
                                    {/* Success Header */}
                                    <div className="text-center mb-10">
                                        <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-6 shadow-xl shadow-emerald-500/10">
                                            <span className="material-symbols-outlined text-4xl text-success" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        </div>
                                        <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Appointment Confirmed!</h2>
                                        <p className="text-slate-500 font-medium">A confirmation summary has been generated for your records.</p>
                                    </div>

                                    {/* Summary Card: Bento Style */}
                                    <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-200/50 text-left">
                                        <div className="p-8 border-b border-slate-100 flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Patient Details</p>
                                                <h3 className="text-2xl font-black text-slate-900">{form.patient}</h3>
                                                <p className="text-sm text-slate-400 font-mono mt-1">CP-8842-X</p>
                                            </div>
                                            <div className="bg-primary/5 px-4 py-2 rounded-xl flex flex-col items-end">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Status</span>
                                                <div className="flex items-center gap-2 text-primary font-black text-sm">
                                                    <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                                                    Scheduled
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 divide-x divide-slate-100">
                                            <div className="p-6">
                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                    <span className="material-symbols-outlined text-lg">calendar_month</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Date</span>
                                                </div>
                                                <p className="text-sm font-black text-slate-900">{selDate ? selDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                    <span className="material-symbols-outlined text-lg">schedule</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Time</span>
                                                </div>
                                                <p className="text-sm font-black text-slate-900">{form.time || '—'}</p>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                                    <span className="material-symbols-outlined text-lg">medical_services</span>
                                                    <span className="text-[10px] font-black uppercase tracking-wider">Practitioner</span>
                                                </div>
                                                <p className="text-sm font-black text-slate-900">{form.doctor}</p>
                                            </div>
                                        </div>

                                        {/* Location */}
                                        <div className="bg-slate-50 p-6 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm">
                                                    <span className="material-symbols-outlined text-primary">map</span>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Location</p>
                                                    <p className="text-sm font-bold text-slate-700">Main Clinical Wing, Suite 402</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => showToast('Opening map location for Main Clinical Wing, Suite 402...', 'info')}
                                                className="text-primary text-[11px] font-black uppercase tracking-wider hover:underline"
                                            >
                                                View Map
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={handleDownload}
                                            disabled={isDownloading}
                                            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-wait"
                                        >
                                            <motion.span
                                                animate={isDownloading ? { rotate: 360 } : {}}
                                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                                className="material-symbols-outlined text-[20px]"
                                            >
                                                {isDownloading ? 'progress_activity' : 'download'}
                                            </motion.span>
                                            {isDownloading ? 'Downloading…' : 'Download PDF'}
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-6 py-4 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">print</span>
                                            Print Slip
                                        </button>
                                    </div>

                                    {/* Footer Links */}
                                    <div className="mt-12 flex items-center justify-center gap-10 border-t border-slate-100 pt-8">
                                        <button onClick={onClose} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">
                                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                                            Return to Dashboard
                                        </button>
                                        <button
                                            onClick={handleModify}
                                            className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
                                        >
                                            <span className="material-symbols-outlined text-lg">event_repeat</span>
                                            Modify Appointment
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Quick Add Modal Overlay ── */}
                <AnimatePresence>
                    {showQuickAdd && (
                        <QuickAddModal
                            onClose={() => setShowQuickAdd(false)}
                            onSuccess={onQuickAddSuccess}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>

    );
}

/* ═══════════════════════════════════════════════════════════
   Main page component
═══════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /* ── State ── */
    const [MONTH_APPTS, setMONTH_APPTS] = useState({});
    const [WEEK_APPTS, setWEEK_APPTS]   = useState([]);
    const [DAY_APPTS, setDAY_APPTS]     = useState([]);
    const [TODAY_SCHEDULE, setTODAY_SCHEDULE] = useState([]);
    const { raw: rawAppointments, loading: isLoadingAppts } = useAppointments({ mode: 'all' });

    const [view,       setView]       = useState('Month');
    const [viewYear,   setViewYear]   = useState(now.getFullYear());
    const [viewMonth,  setViewMonth]  = useState(now.getMonth());
    const [wkStart,    setWkStart]    = useState(() => weekStart(now));
    const [dayDate,    setDayDate]    = useState(today);
    const [nowPx,      setNowPx]      = useState(null);

    useEffect(() => {
        if (!rawAppointments) return;
        const mAppts = {};
        const wAppts = [];
        const dAppts = [];
        const tSchedule = [];

        rawAppointments.forEach(appt => {
            if (!appt.appointment_time) return;
            const date = new Date(appt.appointment_time);
            const y = date.getFullYear();
            const m = date.getMonth();
            const d = date.getDate();
            const h = date.getHours();
            const min = date.getMinutes();
            const dateKey = `${y}-${m+1}-${d}`;
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const patientName = appt.patients?.users ? `${appt.patients.users.first_name} ${appt.patients.users.last_name}` : 'Unknown';
            const type = appt.reason_for_visit || 'Consultation';

            if (!mAppts[dateKey]) mAppts[dateKey] = [];
            mAppts[dateKey].push({ time: timeStr, patient: patientName, cls: 'bg-primary/10 text-primary border-l-2 border-primary' });

            const dayIdx = date.getDay();
            const wkDayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            wAppts.push({ dayIdx: wkDayIdx, startH: h, startM: min, dur: 60, patient: patientName, type: type, style: 'primary' });

            dAppts.push({ startH: h, startM: min, dur: 60, patient: patientName, type: type, status: appt.status || 'Confirmed', sn: 'confirmed' });

            if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) {
                tSchedule.push({ time: timeStr, patient: patientName, type: type, status: appt.status || 'Pending', sc: 'bg-primary/10 text-primary', cc: 'bg-white border border-slate-100' });
            }
        });
        setMONTH_APPTS(mAppts);
        setWEEK_APPTS(wAppts);
        setDAY_APPTS(dAppts);
        setTODAY_SCHEDULE(tSchedule);
    }, [rawAppointments]);
    const [showModal,  setShowModal]  = useState(false);

    const location = useLocation();

    useEffect(() => {
        if (location.state?.openScheduleModal) {
            setShowModal(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    /* ── Tick the NOW indicator every minute ── */
    useEffect(() => {
        const calc = () => {
            const n = new Date();
            const h = n.getHours(), m = n.getMinutes();
            setNowPx(h >= START_HOUR && h < END_HOUR
                ? (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT
                : null);
        };
        calc();
        const id = setInterval(calc, 60_000);
        return () => clearInterval(id);
    }, []);

    /* ── Navigation helpers ── */
    const prevMonth  = () => viewMonth === 0  ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
    const nextMonth  = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0))  : setViewMonth(m => m + 1);
    const shiftWeek  = n  => setWkStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + n * 7); return nd; });
    const shiftDay   = n  => setDayDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + n);     return nd; });

    /* ── Week derived values ── */
    const wkDays        = Array.from({ length: 7 }, (_, i) => { const d = new Date(wkStart); d.setDate(d.getDate() + i); return d; });
    const wkEnd         = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6);
    const wkHasToday    = today >= wkStart && today <= wkEnd;
    const todayWkIdx    = toWeekIdx(today.getDay());
    const isToday       = same(dayDate, today);
    const totalGridH    = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    /* ── Week header label ── */
    const wkLabel = wkDays[0].getMonth() === wkDays[6].getMonth()
        ? `${MONTH_NAMES[wkDays[0].getMonth()]} ${wkDays[0].getDate()} – ${wkDays[6].getDate()}, ${wkDays[0].getFullYear()}`
        : `${MONTH_NAMES[wkDays[0].getMonth()]} ${wkDays[0].getDate()} – ${MONTH_NAMES[wkDays[6].getMonth()]} ${wkDays[6].getDate()}, ${wkDays[6].getFullYear()}`;

    return (
        <DashboardLayout role="secretary">
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ─────────────── Page header ─────────────── */}
                <header className="h-[68px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-xl">calendar_today</span>
                            <h2 className="text-slate-900 text-lg font-black tracking-tight">Appointment Calendar</h2>
                        </div>

                        {/* View switcher pill (always visible in header) */}
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                            {['Month', 'Week', 'Day'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        view === v ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Schedule Appointment
                    </motion.button>
                </header>

                {/* ─────────────── Body ─────────────── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ──────── Main calendar area ──────── */}
                    <div className="flex-1 overflow-y-auto p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={view}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.18 }}
                            >
                                {/* ══════════════ MONTH VIEW ══════════════ */}
                                {view === 'Month' && (() => {
                                    const cells  = monthCells(viewYear, viewMonth);
                                    const rows   = cells.length / 7;
                                    const thisMo = viewYear === today.getFullYear() && viewMonth === today.getMonth();
                                    return (
                                        <>
                                            <div className="mb-6">
                                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Appointment Calendar</h1>
                                                <p className="text-slate-500 mt-1">View and manage clinic schedules.</p>
                                            </div>

                                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                                {/* Toolbar */}
                                                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-xl font-black text-slate-900">
                                                            {MONTH_NAMES[viewMonth]} {viewYear}
                                                        </h3>
                                                        <div className="flex gap-1">
                                                            {[['chevron_left', prevMonth], ['chevron_right', nextMonth]].map(([icon, fn], i) => (
                                                                <motion.button key={i} whileHover={{ scale: 1.1 }} onClick={fn} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                                                    <span className="material-symbols-outlined text-slate-500 text-[20px]">{icon}</span>
                                                                </motion.button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Weekday labels */}
                                                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                                                    {CAL_DAYS.map(d => (
                                                        <div key={d} className="py-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
                                                    ))}
                                                </div>

                                                {/* Day cells */}
                                                <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(108px, 1fr))` }}>
                                                    {cells.map((day, idx) => {
                                                        const key   = day ? `${viewYear}-${viewMonth + 1}-${day}` : null;
                                                        const appts = key && MONTH_APPTS[key] ? MONTH_APPTS[key] : [];
                                                        const isTod = thisMo && day === today.getDate();
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`border-b p-2 flex flex-col ${idx % 7 === 6 ? '' : 'border-r'} border-slate-100 transition-colors
                                                                    ${!day ? 'bg-slate-50/40' : isTod ? 'bg-primary/5' : 'bg-white hover:bg-slate-50/60'}`}
                                                            >
                                                                {day && (
                                                                    <>
                                                                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1.5
                                                                            ${isTod ? 'bg-primary text-white shadow-md shadow-primary/30' : 'text-slate-600'}`}>
                                                                            {day}
                                                                        </span>
                                                                        <div className="flex flex-col gap-1 overflow-hidden">
                                                                            {appts.map((a, ai) => (
                                                                                <div key={ai} className={`px-2 py-0.5 rounded text-[10px] font-bold truncate ${a.cls}`}>
                                                                                    {a.time} {a.patient}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                {/* ══════════════ WEEK VIEW ══════════════ */}
                                {view === 'Week' && (
                                    <>
                                        {/* Heading + navigation */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{wkLabel}</h1>
                                                <p className="text-slate-500 mt-1">
                                                    Week {weekNum(wkStart)} · {WEEK_APPTS.length} appointments scheduled
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <IconBtn icon="chevron_left"  onClick={() => shiftWeek(-1)} />
                                                <IconBtn icon="chevron_right" onClick={() => shiftWeek(1)}  />
                                            </div>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            {/* Day-of-week headers */}
                                            <div className="flex border-b border-slate-100">
                                                <div className="w-16 shrink-0 border-r border-slate-100 bg-slate-50" />
                                                {wkDays.map((d, i) => {
                                                    const isTod = same(d, today);
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`flex-1 p-4 text-center border-r border-slate-100 last:border-r-0 bg-slate-50 ${isTod ? '!bg-primary/5' : ''}`}
                                                        >
                                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isTod ? 'text-primary' : 'text-slate-400'}`}>
                                                                {WEEK_DAYS[i]}
                                                            </p>
                                                            <p className={`text-xl font-black mt-1 ${isTod ? 'text-primary' : 'text-slate-700'}`}>
                                                                {d.getDate()}
                                                            </p>
                                                            {isTod && <div className="mx-auto w-1.5 h-1.5 bg-primary rounded-full mt-1" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Scrollable time grid */}
                                            <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
                                                <div className="relative" style={{ height: totalGridH, minWidth: 700 }}>

                                                    {/* Horizontal hour lines + time labels */}
                                                    {HOURS.map((h, i) => (
                                                        <div
                                                            key={h}
                                                            className="absolute left-0 right-0 border-b border-slate-50 flex items-start"
                                                            style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                                        >
                                                            <div className="w-16 shrink-0 pt-2 px-3 text-right">
                                                                <span className="text-[10px] font-bold text-slate-400">{fmtH(h)}</span>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* 7 day columns + absolute-positioned appointments */}
                                                    <div className="absolute inset-0 left-16 grid grid-cols-7">
                                                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                                                            const colAppts  = WEEK_APPTS.filter(a => a.dayIdx === dayIdx);
                                                            const isTodayCol = wkHasToday && dayIdx === todayWkIdx;
                                                            return (
                                                                <div
                                                                    key={dayIdx}
                                                                    className={`relative border-l border-slate-50 ${isTodayCol ? 'bg-primary/[0.025]' : ''}`}
                                                                >
                                                                    {colAppts.map((appt, ai) => {
                                                                        const top    = (appt.startH - START_HOUR) * HOUR_HEIGHT + (appt.startM / 60) * HOUR_HEIGHT;
                                                                        const height = Math.max((appt.dur / 60) * HOUR_HEIGHT, 44);
                                                                        const s      = WSM[appt.style] ?? WSM.light;
                                                                        return (
                                                                            <motion.div
                                                                                key={ai}
                                                                                initial={{ opacity: 0, scale: 0.93 }}
                                                                                animate={{ opacity: 1, scale: 1 }}
                                                                                transition={{ delay: ai * 0.06, duration: 0.25 }}
                                                                                whileHover={{ scale: 1.03, zIndex: 50 }}
                                                                                className={`absolute mx-1 rounded-xl p-2.5 cursor-pointer z-10 border overflow-hidden ${s.card}`}
                                                                                style={{ top, height, left: 0, right: 0 }}
                                                                            >
                                                                                <p className={`text-[9px] font-black uppercase tracking-wider ${s.time}`}>
                                                                                    {fmtHM(appt.startH, appt.startM)}
                                                                                </p>
                                                                                <p className={`font-bold text-[13px] mt-0.5 truncate leading-tight ${s.name}`}>
                                                                                    {appt.patient}
                                                                                </p>
                                                                                {height > 65 && (
                                                                                    <p className={`text-[11px] truncate mt-0.5 ${s.type}`}>{appt.type}</p>
                                                                                )}
                                                                            </motion.div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ══════════════ DAY VIEW ══════════════ */}
                                {view === 'Day' && (
                                    <>
                                        {/* Heading + navigation */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                                    {dayDate.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                                                </h1>
                                                <p className="text-slate-500 mt-1">
                                                    {isToday
                                                        ? `${DAY_APPTS.length} appointments scheduled for today`
                                                        : 'Navigate to today to see appointments.'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <IconBtn icon="chevron_left"  onClick={() => shiftDay(-1)} />
                                                <IconBtn icon="chevron_right" onClick={() => shiftDay(1)}  />
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                                            {/* Current-time red line */}
                                            {isToday && nowPx !== null && (
                                                <div
                                                    className="absolute left-0 right-0 flex items-center z-30 pointer-events-none"
                                                    style={{ top: nowPx }}
                                                >
                                                    <div className="w-20 flex justify-end pr-3">
                                                        <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded leading-none">NOW</span>
                                                    </div>
                                                    <div className="flex-1 h-0.5 bg-red-500" />
                                                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                                                </div>
                                            )}

                                            <div className="divide-y divide-slate-100">
                                                {HOURS.map((h, hi) => {
                                                    const appt    = isToday ? DAY_APPTS.find(a => a.startH === h) : null;
                                                    const isLunch = h === 12;
                                                    const s       = appt ? (DSM[appt.sn] ?? DSM.confirmed) : null;
                                                    const endMin  = appt ? appt.startH * 60 + appt.startM + appt.dur : 0;

                                                    return (
                                                        <motion.div
                                                            key={h}
                                                            initial={{ opacity: 0, x: -8 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: hi * 0.04, duration: 0.25 }}
                                                            className={`flex min-h-[100px] group ${isLunch ? 'bg-slate-50/60' : ''}`}
                                                        >
                                                            {/* Time label */}
                                                            <div className="w-20 pt-4 px-4 text-right shrink-0">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLunch ? 'text-slate-300' : 'text-slate-400'}`}>
                                                                    {fmtH(h)}
                                                                </span>
                                                            </div>

                                                            {/* Slot content */}
                                                            <div className="flex-1 p-4 border-l border-slate-100">
                                                                {isLunch ? (
                                                                    <div className="flex items-center h-full">
                                                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                                                                            Staff Lunch Break
                                                                        </span>
                                                                    </div>

                                                                ) : appt && s ? (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        whileHover={{ scale: 1.01 }}
                                                                        className={`rounded-xl p-4 cursor-pointer ${s.card}`}
                                                                    >
                                                                        <div className="flex justify-between items-start gap-3">
                                                                            <div className="min-w-0">
                                                                                <p className={`text-xs font-black uppercase tracking-tight ${s.time}`}>
                                                                                    {fmtHM(appt.startH, appt.startM)} – {fmtHM(Math.floor(endMin / 60), endMin % 60)}
                                                                                </p>
                                                                                <h4 className={`font-black mt-0.5 truncate ${s.name}`}>{appt.patient}</h4>
                                                                                <p className={`text-xs mt-0.5 ${s.type}`}>{appt.type}</p>
                                                                            </div>
                                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${s.badge}`}>
                                                                                {appt.status === 'In Progress' && (
                                                                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                                                )}
                                                                                {appt.status}
                                                                            </span>
                                                                        </div>
                                                                    </motion.div>

                                                                ) : (
                                                                    <div className="flex items-center h-full">
                                                                        <span className="text-xs text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            + Add appointment
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}

                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* ──────── Today's Schedule sidebar ──────── */}
                    <motion.aside
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0,  opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-72 border-l border-slate-200 bg-white overflow-y-auto hidden lg:block shrink-0"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-black text-slate-900">Today's Schedule</h3>
                                <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg">4 Pending</span>
                            </div>

                            <div className="space-y-3">
                                {TODAY_SCHEDULE.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: 16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 + i * 0.09 }}
                                        className={`p-4 rounded-xl cursor-pointer hover:shadow-sm transition-all ${item.cc}`}
                                    >
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase mb-2 ${item.sc}`}>
                                            {item.status}
                                        </span>
                                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{item.patient}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.time} · {item.type}</p>
                                    </motion.div>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowModal(true)}
                                className="w-full mt-5 py-3 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Book Appointment
                            </button>

                            {/* Goal card */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                                className="mt-6 p-5 bg-primary rounded-2xl text-white relative overflow-hidden"
                            >
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1.5">Today's Goal</p>
                                    <h4 className="font-black text-xl">12 / 15 Appointments</h4>
                                    <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '80%' }}
                                            transition={{ delay: 0.9, duration: 1.2, ease: 'easeOut' }}
                                            className="bg-white h-full rounded-full"
                                        />
                                    </div>
                                    <p className="text-[11px] opacity-60 mt-2">80% of daily target</p>
                                </div>
                                <motion.span
                                    animate={{ rotate: [12, 0, 12] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-10 pointer-events-none select-none"
                                >
                                    analytics
                                </motion.span>
                            </motion.div>
                        </div>
                    </motion.aside>

                </div>
            </div>

            {/* ── Schedule appointment modal ── */}
            <AnimatePresence>
                {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
            </AnimatePresence>
        </DashboardLayout>
    );
}
