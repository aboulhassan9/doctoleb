/**
 * QuickAddPatientModal — centered overlay to register a walk-in patient.
 * Used inside the ScheduleAppointmentModal so the user can create
 * a new patient record without leaving the booking flow.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@ui/contexts/ToastContext';
import { getErrorMessage } from '@core/lib/errors';
import { patientService } from '@core/services/patients';
import { parseWithSchema, walkInPatientSchema } from '@core/schemas';
import { SLabel, sInput } from './calendar/calendarConstants';

const BLANK_QUICK_FORM = {
    name: '', dob: '', gender: 'Select Gender',
    mobile: '', email: '', insurance: '', policy: '',
};

export default function QuickAddPatientModal({ onClose, onSuccess }) {
    const { showToast } = useToast();
    const [form, setForm]     = useState(BLANK_QUICK_FORM);
    const [saving, setSaving] = useState(false);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleRegister = async () => {
        const { data: payload, error: validationError } = parseWithSchema(walkInPatientSchema, {
            full_name: form.name,
            phone: form.mobile,
            email: form.email,
            date_of_birth: form.dob,
        });

        if (validationError) {
            showToast(validationError, 'error');
            return;
        }

        setSaving(true);
        const { data, error } = await patientService.createWalkIn(payload);
        setSaving(false);

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
                        {/* Full Name */}
                        <div className="col-span-2 space-y-2">
                            <SLabel>Full Name (First &amp; Last)</SLabel>
                            <input
                                value={form.name}
                                onChange={e => setField('name', e.target.value)}
                                className={sInput}
                                placeholder="e.g. Jonathan Doe"
                            />
                        </div>

                        {/* DOB */}
                        <div className="space-y-2">
                            <SLabel>Date of Birth</SLabel>
                            <input type="date" value={form.dob} onChange={e => setField('dob', e.target.value)} className={sInput} />
                        </div>

                        {/* Gender */}
                        <div className="space-y-2">
                            <SLabel>Gender Selection</SLabel>
                            <select value={form.gender} onChange={e => setField('gender', e.target.value)} className={sInput}>
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
                                    value={form.mobile}
                                    onChange={e => setField('mobile', e.target.value)}
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
                                    value={form.email}
                                    onChange={e => setField('email', e.target.value)}
                                    className={sInput + ' pl-10'}
                                />
                            </div>
                        </div>

                        {/* Insurance */}
                        <div className="space-y-2">
                            <SLabel>Insurance Company</SLabel>
                            <input placeholder="e.g. Blue Cross" value={form.insurance} onChange={e => setField('insurance', e.target.value)} className={sInput} />
                        </div>

                        {/* Policy */}
                        <div className="space-y-2">
                            <SLabel>Policy Number</SLabel>
                            <input placeholder="e.g. 123456789" value={form.policy} onChange={e => setField('policy', e.target.value)} className={sInput} />
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
                        disabled={saving || !form.name || !form.mobile}
                        className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                        {saving ? 'Registering...' : 'Register & Continue to Appointment'}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
}
