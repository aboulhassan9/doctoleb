/**
 * AppointmentConfirmation — success step shown after booking.
 * Displays a bento-style summary card with download/print actions.
 */
import { motion } from 'framer-motion';
import { useToast } from '@ui/contexts/ToastContext';

export default function AppointmentConfirmation({
    form,
    selectedDate,
    selectedPatientData,
    onClose,
    onModify,
}) {
    const { showToast } = useToast();

    const handlePrint = () => {
        window.print();
        showToast('Print dialog opened for the appointment confirmation.', 'success');
    };

    const patientName = selectedPatientData
        ? `${selectedPatientData.users?.first_name || ''} ${selectedPatientData.users?.last_name || ''}`.trim()
        : form.patient || 'Patient';

    const patientIdShort = selectedPatientData?.id?.split('-')[0] || '—';

    return (
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
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
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

                    {/* Summary Card */}
                    <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/50 border border-slate-200/50 text-left">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Patient Details</p>
                                <h3 className="text-2xl font-black text-slate-900">{patientName}</h3>
                                <p className="text-sm text-slate-400 font-mono mt-1">{patientIdShort}</p>
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
                                <p className="text-sm font-black text-slate-900">{selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
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
                                    <span className="text-[10px] font-black uppercase tracking-wider">Department</span>
                                </div>
                                <p className="text-sm font-black text-slate-900">{form.department || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={handlePrint}
                            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">print</span>
                            Print Confirmation
                        </button>
                        <button
                            onClick={onModify}
                            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-6 py-4 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px]">event_repeat</span>
                            Modify Booking
                        </button>
                    </div>

                    {/* Footer Links */}
                    <div className="mt-12 flex items-center justify-center gap-10 border-t border-slate-100 pt-8">
                        <button onClick={onClose} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                            Return to Dashboard
                        </button>
                        <button onClick={onModify} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest">
                            <span className="material-symbols-outlined text-lg">event_repeat</span>
                            Modify Appointment
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
