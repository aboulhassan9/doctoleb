/**
 * DoctorTodayAppointments — appointment table for the doctor dashboard.
 *
 * Shows today's appointments with patient name, time, status, and encounter action.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { fadeUp } from '@/lib/animations';

export default function DoctorTodayAppointments({ appointments, loading }) {
    const navigate = useNavigate();

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Today's Appointment List</h3>
                <button onClick={() => navigate('/doctor-appointments')} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                    View Calendar <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Name</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={`skel-${i}`} className="animate-pulse">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                                            <div className="h-4 bg-slate-200 rounded w-28"></div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                                    <td className="px-6 py-4"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
                                    <td className="px-6 py-4 text-right"><div className="h-7 bg-slate-200 rounded-lg w-24 ml-auto"></div></td>
                                </tr>
                            ))
                        ) : appointments.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-16 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">event_busy</span>
                                    <p className="text-sm font-medium text-slate-400">No appointments scheduled for today</p>
                                </td>
                            </tr>
                        ) : appointments.map((appt, i) => (
                            <motion.tr key={i} variants={fadeUp} whileHover={{ backgroundColor: 'rgba(var(--primary-rgb), 0.05)' }} className="group cursor-pointer">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3" onClick={() => navigate(`/doctor-patient/${appt.patientId}`)}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${appt.statusColor}`}>
                                            {appt.initials}
                                        </div>
                                        <span className="font-bold text-sm text-slate-900">{appt.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-slate-600 tabular-nums">{appt.time}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${appt.statusColor}`}>
                                        {appt.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => navigate(`/doctor-encounter/${appt.id}`)} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all">Start Encounter</button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
