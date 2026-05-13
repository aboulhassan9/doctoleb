/**
 * PreDoctorQueueList — appointment queue for the pre-doctor dashboard.
 *
 * Shows upcoming appointments with pre-check and "Ready" actions.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function PreDoctorQueueList({ appointments, loading, onPatientReady }) {
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-36"></div>
                            <div className="h-3 bg-slate-200 rounded w-24"></div>
                        </div>
                        <div className="space-y-2 text-right">
                            <div className="h-4 bg-slate-200 rounded w-14 ml-auto"></div>
                            <div className="h-3 bg-slate-200 rounded w-20 ml-auto"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (appointments.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="py-14 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">event_available</span>
                    <p className="text-sm font-medium text-slate-400">No appointments in queue right now</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {appointments.map((appt, i) => {
                const pt = appt.patients?.users;
                const name = pt ? `${pt.first_name} ${pt.last_name}` : 'Unknown Patient';
                const initials = pt ? `${(pt.first_name?.[0]||'').toUpperCase()}${(pt.last_name?.[0]||'').toUpperCase()}` : '?';
                const time = new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                    <motion.div
                        key={appt.id || i}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.08 }}
                        whileHover={{ backgroundColor: 'rgba(var(--primary-rgb), 0.03)' }}
                        onClick={() => navigate('/predoctor-new-check', { state: { patient: appt.patients, appointmentId: appt.id } })}
                        className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 cursor-pointer transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-primary/10 text-primary">
                            {initials}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-900">{name}</p>
                            <p className="text-xs text-slate-400">{appt.reason || 'General Assessment'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{time}</p>
                            <p className="text-xs text-slate-400">ID: {appt.patients?.id?.split('-')[0]}</p>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => navigate('/predoctor-new-check', { state: { patient: appt.patients, appointmentId: appt.id } })}
                                className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                            >
                                Pre-Check
                            </button>
                            <button
                                onClick={() => onPatientReady(appt)}
                                className="px-3 py-1.5 text-xs font-bold text-success border border-success/20 rounded-lg hover:bg-success hover:text-white transition-all"
                            >
                                Ready ✓
                            </button>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
