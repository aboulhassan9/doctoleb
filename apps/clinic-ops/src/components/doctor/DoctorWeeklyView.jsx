/**
 * DoctorWeeklyView — weekly time-grid calendar with live appointment context.
 */
import { motion } from 'framer-motion';

const HOURS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorWeeklyView({
    weeklyAppointments,
    currentDate = new Date(),
    todayAppointments = [],
    completedThisWeek = 0,
    weeklyGoal = 10,
    onAppointmentOpen,
    onViewAll,
    onEditPolicy,
}) {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekDates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return date;
    });
    const todayKey = new Date().toDateString();
    const goalPercent = Math.min(100, Math.round((completedThisWeek / Math.max(weeklyGoal, 1)) * 100));

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                <div className="calendar-grid bg-slate-50/50 border-b border-slate-200">
                    <div className="p-4 border-r border-slate-100"></div>
                    {WEEK_DAYS.map((day, i) => {
                        const isToday = weekDates[i].toDateString() === todayKey;
                        return (
                            <div key={day} className={`p-4 border-r border-slate-100 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</p>
                                <p className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-slate-900'}`}>{weekDates[i].getDate()}</p>
                            </div>
                        );
                    })}
                </div>
                <div className="relative h-[600px] overflow-y-auto">
                    <div className="calendar-grid h-full relative">
                        <div className="border-r border-slate-100 bg-slate-50/30">
                            {HOURS.map((hour) => (
                                <div key={hour} className="h-20 flex justify-center pt-2 text-[10px] font-bold text-slate-400">{hour}</div>
                            ))}
                        </div>
                        {weekDates.map((date, i) => (
                            <div key={date.toISOString()} className={`border-r border-slate-100 relative ${date.toDateString() === todayKey ? 'bg-primary/5' : i === 5 || i === 6 ? 'bg-slate-50/30' : ''}`}></div>
                        ))}
                        <div className="absolute inset-0 pointer-events-none">
                            {HOURS.map((_, i) => (
                                <div key={i} className="h-20 border-b border-slate-100"></div>
                            ))}
                        </div>
                        {weeklyAppointments.map((appt, i) => {
                            const dayIndex = WEEK_DAYS.indexOf(appt.day);
                            const hourIndex = parseInt(appt.time.split(':')[0], 10) - 8;
                            const top = hourIndex * 80;
                            const left = 80 + (dayIndex * ((100 - 80) / 7));
                            const width = (100 - 80) / 7;
                            return (
                                <button
                                    key={appt.id || i}
                                    type="button"
                                    onClick={() => onAppointmentOpen?.(appt.id)}
                                    className={`absolute px-1.5 pt-1 text-left focus:outline-none focus:ring-2 focus:ring-primary/30 ${appt.textDark ? 'text-slate-900' : 'text-white'}`}
                                    style={{ top: `${top}px`, left: `${left}%`, width: `${width}%`, height: `${(appt.duration / 60) * 80}px` }}
                                >
                                    <div className={`h-full ${appt.color} rounded-lg p-3 border-l-4 ${appt.colorClass} shadow-lg`}>
                                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">{appt.time}</p>
                                        <p className="text-xs font-bold mt-1 leading-tight">{appt.name}</p>
                                        <p className={`text-[10px] mt-1 ${appt.textDark ? 'text-slate-500' : 'text-blue-100'}`}>{appt.type}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Upcoming Today</h3>
                        <button type="button" onClick={onViewAll} className="text-primary font-bold text-xs hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                        {todayAppointments.length === 0 ? (
                            <p className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-400">No remaining appointments today.</p>
                        ) : todayAppointments.slice(0, 4).map((appt) => (
                            <button key={appt.id} type="button" onClick={() => onAppointmentOpen?.(appt.id)} className="flex w-full items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group text-left">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined">person</span></div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{appt.patientName || 'Patient'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{appt.reason || 'Consultation'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary">{new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-[10px] text-slate-400">{appt.statusLabel || appt.status}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="col-span-4 space-y-6">
                    <div className="bg-primary-hover p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Weekly Goal</p>
                            <h4 className="text-2xl font-black mb-1">{completedThisWeek} / {weeklyGoal}</h4>
                            <p className="text-xs font-medium opacity-80 mb-6">Patient Consultations Completed</p>
                            <div className="w-full h-2 bg-blue-400/30 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${goalPercent}%` }}></div>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                            <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Availability Note</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Availability is managed from schedule templates so booking and calendar views stay in sync.</p>
                        <button type="button" onClick={onEditPolicy} className="mt-4 w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">Manage Schedule</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
