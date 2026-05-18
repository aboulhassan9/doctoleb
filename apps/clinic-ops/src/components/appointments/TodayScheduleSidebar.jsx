/**
 * TodayScheduleSidebar — right-hand sidebar showing today's appointment list
 * and the daily goal progress card.
 */
import { motion } from 'framer-motion';

export default function TodayScheduleSidebar({ todaySchedule, onScheduleClick, onAppointmentClick, dailyGoal = 15 }) {
    const pendingCount = todaySchedule.filter((item) => !['completed', 'cancelled', 'no_show'].includes(item.rawStatus)).length;

    return (
        <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0,  opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-72 border-l border-slate-200 bg-white overflow-y-auto hidden lg:block shrink-0"
        >
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-slate-900">Today's Schedule</h3>
                    <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-lg">
                        {pendingCount} Pending
                    </span>
                </div>

                <div className="space-y-3">
                    {todaySchedule.map((item, i) => (
                        <motion.button
                            type="button"
                            key={i}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.09 }}
                            onClick={() => onAppointmentClick?.(item.record || item)}
                            className={`w-full text-left p-4 rounded-xl cursor-pointer hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${item.cc}`}
                        >
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase mb-2 ${item.sc}`}>
                                {item.status}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 leading-tight">{item.patient}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{item.time} · {item.type}</p>
                        </motion.button>
                    ))}
                </div>

                <button
                    onClick={onScheduleClick}
                    className="w-full mt-5 py-3 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-1.5"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Book Appointment
                </button>

                {/* Goal card */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="mt-6 p-5 bg-primary rounded-2xl text-white relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1.5">Today's Goal</p>
                        <h4 className="font-black text-xl">{todaySchedule.length} / {dailyGoal} Appointments</h4>
                        <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.round((todaySchedule.length / dailyGoal) * 100))}%` }}
                                transition={{ delay: 0.9, duration: 1.2, ease: 'easeOut' }}
                                className="bg-white h-full rounded-full"
                            />
                        </div>
                        <p className="text-[11px] opacity-60 mt-2">{Math.round((todaySchedule.length / dailyGoal) * 100)}% of daily target</p>
                    </div>
                    <motion.span
                        animate={{ rotate: [12, 0, 12] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        className="material-symbols-outlined absolute -bottom-4 -right-4 text-[80px] opacity-10 pointer-events-none select-none"
                    >
                        analytics
                    </motion.span>
                </motion.div>
            </div>
        </motion.aside>
    );
}
