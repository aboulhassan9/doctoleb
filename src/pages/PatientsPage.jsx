import { logError } from '@/lib/logger';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import CountUp from '@/components/CountUp';
import { useToast } from '@/contexts/ToastContext';
import { stagger } from '@/lib/animations';

import { patientService } from '@/services/patients';
import { usePatients } from '@/hooks/features/usePatients';
const ACTION_BTNS = [
    { icon: 'visibility', hover: 'hover:text-primary'   },
    { icon: 'edit',       hover: 'hover:text-slate-700' },
    { icon: 'delete',     hover: 'hover:text-critical'   },
];

const rowAnim = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ── Blank form state ───────────────────────────────────────────────────── */
const BLANK_FORM = {
    fullName:     '',
    dob:          '',
    gender:       '',
    phone:        '',
    email:        '',
    address:      '',
    emergName:    '',
    emergPhone:   '',
    insurance:    '',
    policy:       '',
};

/* ── Input field helper ─────────────────────────────────────────────────── */
function Field({ label, children }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">{label}</label>
            {children}
        </div>
    );
}

const inputCls =
    'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300';

/* ── Section card helper ────────────────────────────────────────────────── */
function Section({ icon, title, children }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   Success screen shown after saving
════════════════════════════════════════════════════════════════ */
function SuccessScreen({ form, patientId, onClose }) {
    const navigate = useNavigate();
    // Format DOB to human-readable
    const formattedDob = form.dob
        ? new Date(form.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';

    return (
        <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col h-full"
        >
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
                        className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-success text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                        </span>
                    </motion.div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Registration Complete</h2>
                        <p className="text-slate-500 text-sm mt-0.5">Patient record has been created successfully.</p>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                </motion.button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-8">
                {/* Hero check */}
                <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
                    className="flex flex-col items-center text-center mb-8"
                >
                    <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mb-5 shadow-sm">
                        <span className="material-symbols-outlined text-success text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                        </span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                        Patient Registered Successfully
                    </h1>
                    <p className="text-slate-500 text-base leading-relaxed max-w-sm">
                        The medical file for <span className="font-semibold text-slate-800">{form.fullName}</span> has been
                        created and is now active in the system.
                    </p>
                </motion.div>

                {/* Profile card */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="rounded-2xl border border-slate-200 overflow-hidden shadow-xl"
                >
                    {/* Blue ID banner */}
                    <div className="bg-primary px-8 py-7 relative overflow-hidden">
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 mb-1">
                                    Assigned Patient ID
                                </p>
                                <h2 className="text-4xl font-black tracking-tighter text-white">{patientId}</h2>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                                <motion.span
                                    animate={{ opacity: [1, 0.4, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.4 }}
                                    className="w-2 h-2 rounded-full bg-emerald-400"
                                />
                                <span className="text-xs font-semibold text-white uppercase tracking-widest">Active</span>
                            </div>
                        </div>
                    </div>

                    {/* Profile summary */}
                    <div className="bg-white p-8">
                        <div className="flex items-center justify-between mb-7 pb-5 border-b border-slate-100">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                                Profile Summary
                            </p>
                            <button 
                                onClick={onClose}
                                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                Edit Patient Data
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-y-7 gap-x-10">
                            {[
                                { label: 'Legal Full Name',  value: form.fullName  || '—' },
                                { label: 'Date of Birth',    value: formattedDob           },
                                { label: 'Primary Contact',  value: form.phone     || '—' },
                                { label: 'Verified Email',   value: form.email     || '—' },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">{label}</p>
                                    <p className="text-base font-semibold text-slate-900 truncate">{value}</p>
                                </div>
                            ))}
                            {form.insurance && (
                                <div className="col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Insurance Provider</p>
                                    <p className="text-base font-semibold text-slate-900">{form.insurance} {form.policy && `· ${form.policy}`}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex flex-col gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/appointments')}
                                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                                Schedule Initial Consultation
                            </motion.button>
                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => alert(`Opening full record for ${form.fullName}...`)}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">badge</span>
                                    Full Record
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">folder_shared</span>
                                    Back to Directory
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Insurance notice */}
                {form.insurance && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-6 text-center text-xs text-slate-400 leading-relaxed"
                    >
                        <span className="font-semibold text-primary">Insurance Alert:</span>{' '}
                        Verification is in progress. Results will be visible in the billing portal within 24 hours.
                    </motion.p>
                )}
            </div>
        </motion.div>
    );
}

/* ════════════════════════════════════════════════════════════════
   Registration slide-over modal  (two-step: form → success)
════════════════════════════════════════════════════════════════ */
function RegisterModal({ onClose, onSave }) {
    const [form,      setForm]      = useState(BLANK_FORM);
    const [saving,    setSaving]    = useState(false);
    const [step,      setStep]      = useState('form');   // 'form' | 'success'
    const [patientId, setPatientId] = useState('');

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSubmit = async e => {
        e.preventDefault();
        setSaving(true);
        const result = await onSave(form);
        setSaving(false);
        if (result?.error) return;
        setPatientId(result?.id || '—');
        setStep('success');
    };

    return (
        <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex"
            onClick={step === 'form' ? onClose : undefined}
        >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

            <motion.div
                key="modal-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="relative ml-auto w-full max-w-2xl h-screen bg-background-light shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {step === 'form' ? (
                        /* ──────── STEP 1: Form ──────── */
                        <motion.div
                            key="form-step"
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.22 }}
                            className="flex flex-col h-full"
                        >
                            {/* Modal header */}
                            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Register New Patient</h2>
                                    <p className="text-slate-500 text-sm mt-0.5">Fill in the details to create a new patient record.</p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </motion.button>
                            </div>

                            {/* Scrollable form body */}
                            <div className="flex-1 overflow-y-auto p-8">
                                <form id="register-form" onSubmit={handleSubmit} className="space-y-5">

                                    <Section icon="person" title="Personal Information">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="md:col-span-2">
                                                <Field label="Full Name">
                                                    <input required type="text" placeholder="Johnathan Doe"
                                                        value={form.fullName} onChange={e => set('fullName', e.target.value)}
                                                        className={inputCls} />
                                                </Field>
                                            </div>
                                            <Field label="Date of Birth">
                                                <input required type="date"
                                                    value={form.dob} onChange={e => set('dob', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                            <Field label="Gender">
                                                <select required value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                                                    <option value="">Select gender</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other / Prefer not to say</option>
                                                </select>
                                            </Field>
                                            <Field label="Phone Number">
                                                <input required type="tel" placeholder="+1 (555) 000-0000"
                                                    value={form.phone} onChange={e => set('phone', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                            <Field label="Email Address">
                                                <input type="email" placeholder="patient@example.com"
                                                    value={form.email} onChange={e => set('email', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                            <div className="md:col-span-2">
                                                <Field label="Home Address">
                                                    <textarea rows={2} placeholder="Street name, City, State, ZIP"
                                                        value={form.address} onChange={e => set('address', e.target.value)}
                                                        className={inputCls + ' resize-none'} />
                                                </Field>
                                            </div>
                                        </div>
                                    </Section>

                                    <Section icon="contact_emergency" title="Emergency Contact">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <Field label="Contact Name">
                                                <input type="text" placeholder="Jane Doe"
                                                    value={form.emergName} onChange={e => set('emergName', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                            <Field label="Contact Phone">
                                                <input type="tel" placeholder="+1 (555) 000-0000"
                                                    value={form.emergPhone} onChange={e => set('emergPhone', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                        </div>
                                    </Section>

                                    <Section icon="shield_with_heart" title="Insurance Provider">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <Field label="Insurance Company">
                                                <input type="text" placeholder="HealthShield Inc."
                                                    value={form.insurance} onChange={e => set('insurance', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                            <Field label="Policy Number">
                                                <input type="text" placeholder="POL-123456789"
                                                    value={form.policy} onChange={e => set('policy', e.target.value)}
                                                    className={inputCls} />
                                            </Field>
                                        </div>
                                    </Section>

                                </form>
                            </div>

                            {/* Footer actions */}
                            <div className="bg-white border-t border-slate-200 px-8 py-5 flex items-center justify-end gap-3 shrink-0">
                                <button type="button" onClick={onClose}
                                    className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <motion.button
                                    type="submit" form="register-form"
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    disabled={saving}
                                    className="relative px-8 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-80 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all min-w-[150px] justify-center"
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
                                            Saving…
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">save</span>
                                            Save Patient
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>

                    ) : (
                        /* ──────── STEP 2: Success ──────── */
                        <SuccessScreen form={form} patientId={patientId} onClose={onClose} />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}

/* ════════════════════════════════════════════════════════════════
   View Modal
════════════════════════════════════════════════════════════════ */
function ViewPatientModal({ patient, onClose }) {
    if (!patient) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Patient Profile</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                        <div className={`w-14 h-14 rounded-full ${patient.color} flex items-center justify-center text-xl font-bold shrink-0`}>
                            {patient.initials}
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-slate-900">{patient.name}</h4>
                            <span className="text-sm font-semibold text-primary">{patient.id}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <p className="text-xs font-bold text-slate-400 mb-1">Phone</p>
                            <p className="font-bold text-slate-700">{patient.phone}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 mb-1">Last Visit</p>
                            <p className="font-bold text-slate-700">{patient.visit}</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                    <button onClick={onClose} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 flex items-center gap-2 ml-auto">
                        <span className="material-symbols-outlined text-[18px]">check</span> Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   Edit Modal
════════════════════════════════════════════════════════════════ */
function EditPatientModal({ patient, onClose, onSave }) {
    const [name, setName] = useState(patient?.name || '');
    const [phone, setPhone] = useState(patient?.phone || '');

    if (!patient) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(patient.id, name, phone);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 text-lg">Edit Patient</h3>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Full Name</label>
                            <input autoFocus required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Phone Number</label>
                            <input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 mt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-white">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">save</span> Save Changes
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════
   Main page
════════════════════════════════════════════════════════════════ */
export default function PatientsPage() {
    const [search,      setSearch]      = useState('');
    const [showModal,   setShowModal]   = useState(false);
    const [viewingPatient, setViewingPatient] = useState(null);
    const [editingPatient, setEditingPatient] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [patientList, setPatientList] = useState([]);
    const { patients, loading, refresh: fetchPatients } = usePatients();

    const { showToast } = useToast();
    const location = useLocation();
    const searchInputRef = useRef(null);

    useEffect(() => {
        if (location.state?.openAddModal) {
            setShowModal(true);
            window.history.replaceState({}, document.title);
        }
        if (location.state?.focusSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
            window.history.replaceState({}, document.title);
        }
        if (location.state?.searchQuery) {
            setSearch(location.state.searchQuery);
            setTimeout(() => searchInputRef.current?.focus(), 100);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        if (!patients) return;
        const mapped = patients.map((p, index) => {
            const firstName = p.users?.first_name || '';
            const lastName = p.users?.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown';
            const colors = [
                'bg-primary/10 text-primary', 'bg-secondary/10 text-secondary',
                'bg-success/10 text-success', 'bg-orange-100 text-orange-700',
                'bg-sky-100 text-sky-700', 'bg-critical/10 text-critical',
            ];
            
            return {
                id: p.id,
                dbId: p.id,
                name: fullName,
                initials: ((firstName[0] || '') + (lastName[0] || '')).toUpperCase(),
                color: colors[index % colors.length],
                phone: p.users?.phone || '—',
                visit: new Date(p.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                raw: p
            };
        });
        setPatientList(mapped);
    }, [patients]);

    const ITEMS_PER_PAGE = 5;

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        return patientList.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            (p.phone && p.phone.includes(search))
        );
    }, [patientList, search]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
    const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleDelete = async (id) => {
        if(window.confirm('Are you sure you want to remove this patient?')) {
            try {
                // Optimistic UI update
                setPatientList(prev => prev.filter(p => p.id !== id));
                showToast('Patient record archived', 'success');
                if (paginated.length === 1 && currentPage > 1) setCurrentPage(currentPage - 1);
                
                await patientService.delete(id);
            } catch (err) {
                logError('Failed to delete patient:', err);
                showToast('Failed to delete patient', 'error');
                fetchPatients(); // Rollback
            }
        }
    };

    const handleEditSave = async (id, newName, newPhone) => {
        const patient = patientList.find(p => p.id === id);
        const userId = patient?.raw?.user_id;
        if (!userId) {
            showToast('Cannot identify patient record', 'error');
            return;
        }

        const parts = newName.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();

        setPatientList(prev => prev.map(p =>
            p.id === id ? { ...p, name: newName, phone: newPhone, initials } : p
        ));
        setEditingPatient(null);

        const { error } = await patientService.updateUserInfo(userId, { firstName, lastName, phone: newPhone });
        if (error) {
            showToast('Failed to update patient', 'error');
            fetchPatients();
        } else {
            showToast('Patient updated successfully', 'success');
        }
    };

    const handleSave = async (form) => {
        const { data, error } = await patientService.createWalkIn({
            full_name: form.fullName,
            phone: form.phone || null,
            email: form.email || null,
            date_of_birth: form.dob || null,
        });
        if (error) {
            showToast(error.message || 'Failed to create patient', 'error');
            return { error };
        }
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

                        {/* Title */}
                        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Patient Directory</h1>
                            <p className="text-slate-500 mt-1 text-base">
                                Manage records, access histories, and update patient profiles.
                            </p>
                        </motion.div>

                        {/* Search + filter bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                            className="flex gap-3"
                        >
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name, ID, or phone number..."
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                />
                            </div>
                            <div className="relative">
                                <button 
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm whitespace-nowrap"
                                >
                                    <span className="material-symbols-outlined text-xl">filter_list</span>
                                    Filters
                                </button>
                                <AnimatePresence>
                                    {showFilters && (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            className="absolute top-[120%] right-0 w-64 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden p-4"
                                        >
                                            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Filter By Status</h4>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                                                    <span className="text-sm font-semibold text-slate-700">Active Patients</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked />
                                                    <span className="text-sm font-semibold text-slate-700">Recent Visits (30 days)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                                                    <span className="text-sm font-semibold text-slate-700">Pending Insurance</span>
                                                </label>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* Table */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            {['Patient ID', 'Name', 'Contact Number', 'Last Visit', 'Actions'].map((col, i) => (
                                                <th key={i} className={`px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 4 ? 'text-right' : ''}`}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <motion.tbody
                                        variants={stagger} initial="hidden" animate="visible"
                                        className="divide-y divide-slate-100"
                                    >
                                        <AnimatePresence>
                                            {loading ? (
                                                Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                                                    <tr key={`skel-${i}`} className="animate-pulse">
                                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                                                                <div className="h-4 bg-slate-200 rounded w-32"></div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                                        <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                                                        <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded w-20 ml-auto"></div></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                paginated.map(p => (
                                                    <motion.tr
                                                        key={p.id}
                                                        variants={rowAnim}
                                                        layout
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="group hover:bg-slate-50/80 transition-colors"
                                                    >
                                                        <td className="px-6 py-4 text-sm font-semibold text-primary">{p.id}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-xs font-bold shrink-0`}>
                                                                    {p.initials}
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-900">{p.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.phone}</td>
                                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">{p.visit}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                <motion.button
                                                                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }}
                                                                    onClick={() => setViewingPatient(p)}
                                                                    className={`p-1.5 text-slate-400 hover:text-primary transition-colors`}
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">visibility</span>
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }}
                                                                    onClick={() => setEditingPatient(p)}
                                                                    className={`p-1.5 text-slate-400 hover:text-slate-700 transition-colors`}
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">edit</span>
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.88 }}
                                                                    onClick={() => handleDelete(p.id)}
                                                                    className={`p-1.5 text-slate-400 hover:text-critical transition-colors`}
                                                                >
                                                                    <span className="material-symbols-outlined text-xl">delete</span>
                                                                </motion.button>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                ))
                                            )}
                                        </AnimatePresence>

                                        {!loading && filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-14 text-center text-slate-400 text-sm font-medium">
                                                    No patients found matching "{search}"
                                                </td>
                                            </tr>
                                        )}
                                    </motion.tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="px-6 py-4 flex items-center justify-between bg-slate-50 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500">
                                    Showing {paginated.length} of {patientList.length} patients
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                                    >
                                        Previous
                                    </button>
                                    
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        const n = i + 1;
                                        return (
                                            <button 
                                                key={n} 
                                                onClick={() => setCurrentPage(n)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${n === currentPage ? 'bg-primary text-white border border-primary' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {n}
                                            </button>
                                        );
                                    })}
                                    
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Stats footer */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-4"
                        >
                            {[
                                { label: 'Total Patients',  value: patientList.length, bg: 'bg-primary/5',  border: 'border-primary/10', text: 'text-primary'   },
                                { label: 'Male',            value: patientList.filter(p => (p.raw?.sex || '').toLowerCase() === 'male').length,   bg: 'bg-sky-50',  border: 'border-sky-100',  text: 'text-sky-600'  },
                                { label: 'Female',          value: patientList.filter(p => (p.raw?.sex || '').toLowerCase() === 'female').length, bg: 'bg-pink-50', border: 'border-pink-100', text: 'text-pink-600' },
                            ].map((s, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ y: -3, boxShadow: '0 10px 25px rgba(0,0,0,0.07)' }}
                                    className={`p-6 ${s.bg} border ${s.border} rounded-2xl transition-all`}
                                >
                                    <p className={`text-sm font-semibold ${s.text} mb-2`}>{s.label}</p>
                                    <h3 className="text-3xl font-black text-slate-900 flex items-baseline">
                                        {s.prefix && <span className={`text-xl mr-0.5 ${s.text}`}>{s.prefix}</span>}
                                        <CountUp from={0} to={s.value} duration={2.2} separator="," />
                                        {s.suffix && <span className={`text-xl ml-0.5 ${s.text}`}>{s.suffix}</span>}
                                    </h3>
                                </motion.div>
                            ))}
                        </motion.div>

                    </div>
                </div>
            </div>

            {/* ── Registration modal ── */}
            <AnimatePresence>
                {showModal && (
                    <RegisterModal
                        onClose={() => setShowModal(false)}
                        onSave={handleSave}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {viewingPatient && (
                    <ViewPatientModal patient={viewingPatient} onClose={() => setViewingPatient(null)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingPatient && (
                    <EditPatientModal patient={editingPatient} onClose={() => setEditingPatient(null)} onSave={handleEditSave} />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}