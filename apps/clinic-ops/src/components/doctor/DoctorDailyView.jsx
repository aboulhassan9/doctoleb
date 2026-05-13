/**
 * DoctorDailyView — daily appointment timeline for the doctor's calendar.
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppointmentCancelInlineConfirm } from '@ui/components/appointments/AppointmentCancelInlineConfirm';

export default function DoctorDailyView({
    appointments,
    cancelConfirmId,
    cancelReason,
    cancellingId,
    onCancelOpen,
    onCancelKeep,
    onCancelReasonChange,
    onCancelConfirm,
    getAvatarColor,
}) {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time Slot</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Details & Status</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {appointments.map((appt) => (
                            <motion.div
                                key={appt.id}
                                className={`flex group cursor-pointer hover:bg-primary/5 transition-colors ${appt.cancelled ? 'opacity-60' : ''}`}
                            >
                                <div className="w-24 px-6 py-6 flex flex-col items-center justify-center border-r border-slate-50 shrink-0">
                                    <span className={`text-sm font-bold ${appt.cancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{appt.time}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{appt.timePeriod}</span>
                                </div>
                                <div className="flex-1 px-6 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm ${appt.cancelled ? 'bg-slate-100 text-slate-400 grayscale' : getAvatarColor(appt.name)}`}>
                                            {appt.initials}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold group-hover:text-primary transition-colors ${appt.cancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{appt.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${appt.type === 'Follow-up' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>{appt.type}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{appt.reason}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${appt.status === 'In Progress' ? 'bg-primary/10 text-primary' : appt.status === 'Waiting' ? 'bg-warning/10 text-warning' : appt.status === 'Cancelled' ? 'bg-critical/10 text-critical' : 'bg-success/10 text-success'}`}>{appt.status}</span>
                                            <span className="text-[10px] text-slate-400 mt-1">{appt.room}</span>
                                        </div>
                                        {!appt.cancelled && (
                                            <>
                                                <AppointmentCancelInlineConfirm
                                                    appointmentId={appt.id}
                                                    isConfirming={cancelConfirmId === appt.id}
                                                    reason={cancelConfirmId === appt.id ? cancelReason : ''}
                                                    submitting={cancellingId === appt.id}
                                                    onOpen={onCancelOpen}
                                                    onKeep={onCancelKeep}
                                                    onReasonChange={onCancelReasonChange}
                                                    onConfirm={onCancelConfirm}
                                                    triggerLabel="Cancel"
                                                    className="hidden md:inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-all hover:bg-red-50"
                                                />
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => navigate(`/doctor-encounter/${appt.id}`)}
                                                    className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:brightness-110 transition-all mr-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                                                    Start Encounter
                                                </motion.button>
                                            </>
                                        )}
                                        <span className={`material-symbols-outlined ${appt.cancelled ? 'text-slate-300' : 'text-slate-300 group-hover:text-primary'} transition-colors`}>
                                            {appt.cancelled ? 'block' : 'chevron_right'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mini calendar sidebar */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-slate-900">October 2023</h3>
                        <div className="flex gap-2">
                            <button className="p-1 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                            <button className="p-1 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <span key={i} className="text-[10px] font-bold text-slate-400 text-center">{d}</span>
                        ))}
                        {[22, 23, 24, 25, 26, 27, 28].map((d, i) => (
                            <button key={i} className={`text-xs font-bold p-2 rounded-lg ${d === 25 ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{d}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
