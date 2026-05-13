/**
 * RegisterPatientModal — slide-over form for creating a new patient record.
 * Two-step flow: form → success (PatientRegistrationSuccess).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BLANK_FORM, inputCls, Field, Section } from './patientFormHelpers';
import PatientRegistrationSuccess from './PatientRegistrationSuccess';

export default function RegisterPatientModal({ onClose, onSave }) {
    const [form,      setForm]      = useState(BLANK_FORM);
    const [saving,    setSaving]    = useState(false);
    const [step,      setStep]      = useState('form');
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
                        <PatientRegistrationSuccess form={form} patientId={patientId} onClose={onClose} />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
