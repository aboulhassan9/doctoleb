/**
 * DoctorWeeklyView — weekly time-grid calendar with "upcoming today" sidebar.
 */
import { motion } from 'framer-motion';

const HOURS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorWeeklyView({ weeklyAppointments }) {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                <div className="calendar-grid bg-slate-50/50 border-b border-slate-200">
                    <div className="p-4 border-r border-slate-100"></div>
                    {WEEK_DAYS.map((day, i) => (
                        <div key={day} className={`p-4 border-r border-slate-100 text-center ${day === 'Wed' ? 'bg-primary/5' : ''}`}>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</p>
                            <p className={`text-lg font-bold ${day === 'Wed' ? 'text-primary' : 'text-slate-900'}`}>{23 + i}</p>
                        </div>
                    ))}
                </div>
                <div className="relative h-[600px] overflow-y-auto">
                    <div className="calendar-grid h-full relative">
                        <div className="border-r border-slate-100 bg-slate-50/30">
                            {HOURS.map((hour) => (
                                <div key={hour} className="h-20 flex justify-center pt-2 text-[10px] font-bold text-slate-400">{hour}</div>
                            ))}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className={`border-r border-slate-100 relative ${i === 2 ? 'bg-primary/5/10' : i === 5 || i === 6 ? 'bg-slate-50/30' : ''}`}></div>
                        ))}
                        <div className="absolute inset-0 pointer-events-none">
                            {HOURS.map((_, i) => (
                                <div key={i} className="h-20 border-b border-slate-100"></div>
                            ))}
                        </div>
                        {weeklyAppointments.map((appt, i) => {
                            const dayIndex = WEEK_DAYS.indexOf(appt.day);
                            const hourIndex = parseInt(appt.time.split(':')[0]) - 8;
                            const top = hourIndex * 80;
                            const left = 80 + (dayIndex * ((100 - 80) / 7));
                            const width = (100 - 80) / 7;
                            return (
                                <div key={i} className={`absolute px-1.5 pt-1 ${appt.textDark ? 'text-slate-900' : 'text-white'}`} style={{ top: `${top}px`, left: `${left}%`, width: `${width}%`, height: `${(appt.duration / 60) * 80}px` }}>
                                    <div className={`h-full ${appt.color} rounded-lg p-3 border-l-4 ${appt.colorClass} ${appt.isToday ? 'ring-2 ring-white' : ''} shadow-lg`}>
                                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">{appt.time}</p>
                                        <p className="text-xs font-bold mt-1 leading-tight">{appt.name}</p>
                                        <p className={`text-[10px] mt-1 ${appt.textDark ? 'text-slate-500' : 'text-blue-100'}`}>{appt.type}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Upcoming Today</h3>
                        <button className="text-primary font-bold text-xs">View All</button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><span className="material-symbols-outlined">person</span></div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Robert Vance</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chronic Pain Follow-up</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-primary">03:30 PM</p>
                                <p className="text-[10px] text-slate-400">In 2 hours</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning"><span className="material-symbols-outlined">videocam</span></div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Lucy Graham</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Video Assessment</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-slate-600">04:45 PM</p>
                                <p className="text-[10px] text-slate-400">In 3 hours</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-span-4 space-y-6">
                    <div className="bg-primary-hover p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Weekly Goal</p>
                            <h4 className="text-2xl font-black mb-1">24 / 30</h4>
                            <p className="text-xs font-medium opacity-80 mb-6">Patient Consultations Completed</p>
                            <div className="w-full h-2 bg-blue-400/30 rounded-full overflow-hidden">
                                <div className="w-[80%] h-full bg-white rounded-full"></div>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                            <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-4">Availability Note</h3>
                        <p className="text-xs text-slate-500 leading-relaxed italic">"Doctor on call for Emergency Ward during Thursday morning slots. Rescheduling may occur for 10 AM appointments."</p>
                        <button className="mt-4 w-full py-2 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">Edit Policy</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
