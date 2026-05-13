/**
 * PatientRegistrationSuccess — shown after a new patient record is saved.
 * Displays the profile card with assigned ID and navigation options.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function PatientRegistrationSuccess({ form, patientId, onClose }) {
    const navigate = useNavigate();

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
