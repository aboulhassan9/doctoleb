import { motion } from 'framer-motion';
import { formatClinicDate, formatClinicTime } from '@/lib/time';

export default function AppointmentDetailsDrawer({
    appointment,
    onClose,
    onViewPatient,
    cancelReason,
    cancelling,
    onCancelReasonChange,
    onCancelConfirm,
    primaryAction,
    disabledPrimaryReason,
}) {
    if (!appointment) return null;

    const status = appointment.statusLabel || appointment.status || 'Scheduled';
    const scheduledAt = appointment.scheduled_at || appointment.appointment_time;
    const patientName = appointment.patientName || appointment.patient?.name || appointment.patient || 'Unknown Patient';
    const doctorName = appointment.doctorName || appointment.doctor?.name || 'Assigned doctor';

    return (
        <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl"
            aria-label="Appointment details"
        >
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Appointment</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">{patientName}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close appointment details"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Scheduled time</p>
                        <p className="mt-1 text-sm font-black text-slate-900">
                            {scheduledAt
                                ? `${formatClinicDate(scheduledAt, { month: 'short', day: 'numeric', year: 'numeric' })} · ${formatClinicTime(scheduledAt, { hour: 'numeric', minute: '2-digit' })}`
                                : 'Not scheduled'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-100 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</p>
                            <p className="mt-1 text-sm font-black text-slate-900">{status}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Duration</p>
                            <p className="mt-1 text-sm font-black text-slate-900">{appointment.duration_minutes || 30} min</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{appointment.reason || appointment.type || 'Consultation'}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Doctor</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{doctorName}</p>
                    </div>
                </div>

                <div className="border-t border-slate-100 px-6 py-5">
                    {!['cancelled', 'completed', 'no_show'].includes(appointment.status) && (
                        <div className="mb-4">
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Cancellation reason
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(event) => onCancelReasonChange?.(event.target.value)}
                                rows={2}
                                placeholder="Required before cancelling..."
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    )}
                    {disabledPrimaryReason && !primaryAction && (
                        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                            {disabledPrimaryReason}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={onViewPatient}
                            disabled={!appointment.patient_id && !appointment.patient?.id}
                            className="rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            View patient
                        </button>
                        {primaryAction ? (
                            <button
                                type="button"
                                onClick={primaryAction.onClick}
                                className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-opacity hover:opacity-90"
                            >
                                {primaryAction.label}
                            </button>
                        ) : (
                        <button
                            type="button"
                            onClick={() => onCancelConfirm?.(appointment.id)}
                            disabled={cancelling || ['cancelled', 'completed', 'no_show'].includes(appointment.status) || !cancelReason?.trim()}
                            className="rounded-xl border border-critical/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-critical transition-colors hover:bg-critical/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                        )}
                    </div>
                    {primaryAction && (
                        <button
                            type="button"
                            onClick={() => onCancelConfirm?.(appointment.id)}
                            disabled={cancelling || ['cancelled', 'completed', 'no_show'].includes(appointment.status) || !cancelReason?.trim()}
                            className="mt-3 w-full rounded-xl border border-critical/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-critical transition-colors hover:bg-critical/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cancelling ? 'Cancelling...' : 'Cancel appointment'}
                        </button>
                    )}
                </div>
            </div>
        </motion.aside>
    );
}
