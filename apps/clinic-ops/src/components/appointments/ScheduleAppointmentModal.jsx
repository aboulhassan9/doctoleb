/**
 * ScheduleAppointmentModal — slide-over panel for booking a new appointment.
 * Contains a multi-step flow: form → success confirmation.
 * 
 * Sub-components used:
 *  - MiniCalendar       (date selection)
 *  - QuickAddPatientModal (inline walk-in registration)
 *  - AppointmentConfirmation (success / summary step)
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@ui/contexts/ToastContext';
import { useAuth } from '@ui/contexts/AuthContext';
import { logError } from '@core/lib/logger';
import { usePatients } from '@core/hooks/features/usePatients';
import { appointmentService } from '@core/services/appointments';
import { doctorService } from '@core/services/doctors';
import { slotService } from '@core/services/slots';
import {
    DEPARTMENTS,
    TIME_SLOTS,
    PRIORITY_OPTS,
    BLANK_APPT,
    SLabel,
    sInput,
} from './calendar/calendarConstants';
import { toDateKey } from './calendar/calendarUtils';
import MiniCalendar from './calendar/MiniCalendar';
import QuickAddPatientModal from './QuickAddPatientModal';
import AppointmentConfirmation from './AppointmentConfirmation';

export default function ScheduleAppointmentModal({ onClose, initialDate = null, initialDoctorId = '', initialTime = '', onBooked }) {
    const { showToast } = useToast();
    const { user } = useAuth();

    /* ── Form state ── */
    const [form, setForm]             = useState(BLANK_APPT);
    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const [selectedDate, setSelectedDate]   = useState(initialDate ? new Date(initialDate) : null);
    const [saving, setSaving]         = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [step, setStep]             = useState('form');
    const [searchQuery, setSearchQuery] = useState('');

    /* ── Data ── */
    const { patients: patientsList, loading: loadingPatients, refresh: refreshPatients } = usePatients();
    const [doctorsList, setDoctorsList] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);

    useEffect(() => {
        if (!initialDoctorId && !initialTime) return;
        setForm(prev => ({
            ...prev,
            doctor_id: initialDoctorId || prev.doctor_id,
            time: initialTime || prev.time,
        }));
    }, [initialDoctorId, initialTime]);

    useEffect(() => {
        doctorService.getAll().then(res => setDoctorsList(res.data || []));
    }, []);

    useEffect(() => {
        if (form.doctor_id && selectedDate) {
            slotService.getAvailableSlots(form.doctor_id, toDateKey(selectedDate)).then(res => {
                setAvailableSlots(res.data || []);
            });
        } else {
            setAvailableSlots([]);
        }
    }, [form.doctor_id, selectedDate]);

    const selectedPatientData = patientsList.find(p => p.id === form.patient_id);
    const availableSlotTimes = new Set(availableSlots.map(slot => String(slot.start_time || '').slice(0, 5)));
    const bookableTimeSlots = availableSlots.length > 0
        ? [...availableSlotTimes].sort()
        : TIME_SLOTS;

    useEffect(() => {
        const nextAvailableSlotTimes = new Set(availableSlots.map(slot => String(slot.start_time || '').slice(0, 5)));
        if (form.time && !nextAvailableSlotTimes.has(form.time)) {
            set('time', '');
        }
    }, [availableSlots, form.time]);

    /* ── Handlers ── */
    const handleConfirm = async () => {
        if (!form.patient_id || !selectedDate || !form.time || !form.doctor_id) return;
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
            onBooked?.(result.data);
            setStep('success');
        } catch (error) {
            logError('Failed to book appointment:', error);
            showToast('Failed to schedule appointment', 'error');
        } finally {
            setSaving(false);
        }
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
                                            <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} />
                                            {selectedDate && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                                    className="mt-3 px-3 py-2 bg-primary/5 rounded-xl border border-primary/10 text-xs font-bold text-primary text-center"
                                                >
                                                    {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
                                                {bookableTimeSlots.map(t => {
                                                    const available = availableSlotTimes.has(t);
                                                    const sel = form.time === t;
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
                                    {!selectedDate      && 'Pick a date · '}
                                    {!form.time    && 'Select a time slot'}
                                    {form.patient_id && selectedDate && form.time && form.doctor_id && (
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
                                        disabled={saving || !form.patient_id || !selectedDate || !form.time || !form.doctor_id}
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
                        <AppointmentConfirmation
                            form={form}
                            selectedDate={selectedDate}
                            selectedPatientData={selectedPatientData}
                            onClose={onClose}
                            onModify={() => setStep('form')}
                        />
                    )}
                </AnimatePresence>

                {/* ── Quick Add Modal Overlay ── */}
                <AnimatePresence>
                    {showQuickAdd && (
                        <QuickAddPatientModal
                            onClose={() => setShowQuickAdd(false)}
                            onSuccess={onQuickAddSuccess}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}
