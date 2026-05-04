import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';

import { appointmentService } from '../services/appointments';
import { useAuth } from '../contexts/AuthContext';
import { normalizeAppointments } from '../lib/appointments';
import { formatClinicTime, isSameClinicDay, parseClinicDateTime } from '../lib/time';

const HOURS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorAppointmentsPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState('daily');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [weeklyAppointments, setWeeklyAppointments] = useState([]);
    const [monthlyDays, setMonthlyDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    
    const doctorUser = user ? {
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        role: user.role === 'doctor' ? 'Chief Resident' : 'Doctor',
        initials: `${user.first_name?.[0]||''}${user.last_name?.[0]||''}`.toUpperCase(),
        department: 'General Practice'
    } : { name: 'Doctor', role: 'Doctor', initials: '??', department: '—' };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data } = await appointmentService.getAll();
            if (data) {
                const normalizedData = normalizeAppointments(data);
                // Generate Daily View
                const dailyData = normalizedData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, currentDate));
                const mappedDaily = dailyData.map(a => {
                    const timeDisplay = formatClinicTime(a.scheduled_at, { hour: 'numeric', minute: '2-digit' });
                    const [time = '', timePeriod = ''] = timeDisplay.split(' ');
                    return {
                        id: a.id,
                        name: a.patientName,
                        initials: a.patientInitials,
                        time, timePeriod,
                        type: a.reason || 'Consultation',
                        reason: a.reason || '',
                        status: a.statusLabel || 'Scheduled',
                        room: 'Room 101',
                        cancelled: a.isCancelled
                    };
                });
                setAppointments(mappedDaily);

                // Generate Weekly View
                const start = new Date(currentDate);
                start.setDate(start.getDate() - start.getDay() + 1);
                start.setHours(0,0,0,0);
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                end.setHours(23,59,59,999);
                
                const weeklyData = normalizedData.filter(a => {
                    if(!a.scheduled_at) return false;
                    const d = parseClinicDateTime(a.scheduled_at);
                    return d >= start && d <= end;
                });
                const mappedWeekly = weeklyData.map(a => {
                    const d = parseClinicDateTime(a.scheduled_at);
                    return {
                        day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
                        date: d.getDate(),
                        time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
                        duration: 60,
                        name: a.patientName,
                        type: a.reason || 'Consult',
                        color: 'bg-primary-hover',
                        colorClass: 'border-blue-400'
                    };
                });
                setWeeklyAppointments(mappedWeekly);

                // Generate Monthly View
                const y = currentDate.getFullYear();
                const m = currentDate.getMonth();
                const first = new Date(y, m, 1).getDay();
                const total = new Date(y, m + 1, 0).getDate();
                const prevTotal = new Date(y, m, 0).getDate();
                
                const mDays = [];
                for (let i = first - 1; i >= 0; i--) {
                    mDays.push({ day: prevTotal - i, inMonth: false });
                }
                for (let i = 1; i <= total; i++) {
                    const d = new Date(y, m, i);
                    const apptsForDay = normalizedData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, d));
                    mDays.push({
                        day: i,
                        inMonth: true,
                        isToday: d.toLocaleDateString('en-US') === new Date().toLocaleDateString('en-US'),
                        appointments: apptsForDay.map(a => {
                            const ad = parseClinicDateTime(a.scheduled_at);
                            return {
                                time: `${ad.getHours() % 12 || 12}:${ad.getMinutes().toString().padStart(2, '0')}`,
                                name: a.patientName || 'Patient',
                                type: 'blue'
                            };
                        }).slice(0, 3)
                    });
                }
                let nextDay = 1;
                while (mDays.length % 7 !== 0) {
                    mDays.push({ day: nextDay++, inMonth: false });
                }
                setMonthlyDays(mDays);
            }
            setLoading(false);
        };
        fetchData();

        const sub = appointmentService.subscribeToAppointments(null, () => {
            fetchData();
        });

        return () => {
            if (sub) sub.unsubscribe();
        };
    }, [currentDate]);

    const getAvatarColor = (name) => {
        const colors = {
            'Alexander Wright': 'bg-primary/10 text-primary',
            'Martha Stewart': 'bg-pink-100 text-pink-700',
            'David Chen': 'bg-warning/10 text-warning',
            'Sarah Jenkins': 'bg-success/10 text-success',
            'Emily Rose': 'bg-secondary/10 text-secondary',
        };
        return colors[name] || 'bg-slate-100 text-slate-700';
    };

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const formatWeeklyDate = () => {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay() + 1);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };

    const formatMonthlyDate = () => {
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const goToPrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const goToPrevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const goToNextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
        setView('daily');
    };

    return (
        <div className="flex h-screen w-full bg-[#f5f7f8] text-[#0f172a] overflow-hidden font-['Inter']">
            <DoctorSidebar />

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search appointments, patients..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg mr-4">
                            <button onClick={() => setView('daily')} className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === 'daily' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary'}`}>Day</button>
                            <button onClick={() => setView('weekly')} className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === 'weekly' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary'}`}>Weekly</button>
                            <button onClick={() => setView('monthly')} className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === 'monthly' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary'}`}>Monthly</button>
                        </div>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{doctorUser.name}</p>
                                <p className="text-[10px] text-slate-500">{doctorUser.department}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{doctorUser.initials}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 pb-12">
                    {view === 'daily' && (
                        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between">
                            <div>
                                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Appointments</h2>
                                <p className="text-slate-500 mt-2 text-base">{today} • <span className="text-primary font-bold">{appointments.filter(a => a.status !== 'Cancelled').length} Patients remaining</span></p>
                            </div>
                        </motion.div>
                    )}

                    {view === 'weekly' && (
                        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-end">
                            <div>
                                <h2 className="text-[30px] font-black tracking-tight text-slate-900 font-['Inter'] leading-tight">Weekly Schedule</h2>
                                <p className="text-slate-500 font-medium text-sm">{formatWeeklyDate()}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={goToPrevWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>
                                <button onClick={goToToday} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                                    Today
                                </button>
                                <button onClick={goToNextWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'monthly' && (
                        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-end">
                            <div>
                                <h2 className="text-[30px] font-black tracking-tight text-slate-900">{formatMonthlyDate()}</h2>
                                <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                    <span className="material-symbols-outlined text-sm">event</span>
                                    <span>148 Total Appointments this month</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'daily' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8 space-y-4">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time Slot</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Details & Status</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {appointments.map((appt, i) => (
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
                                                            <motion.button
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => navigate('/doctor-consultation')}
                                                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:brightness-110 transition-all mr-2"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                                                                Start Consultation
                                                            </motion.button>
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
                    )}

                    {view === 'weekly' && (
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
                                                <div
                                                    key={i}
                                                    className={`absolute px-1.5 pt-1 ${appt.textDark ? 'text-slate-900' : 'text-white'}`}
                                                    style={{
                                                        top: `${top}px`,
                                                        left: `${left}%`,
                                                        width: `${width}%`,
                                                        height: `${(appt.duration / 60) * 80}px`
                                                    }}
                                                >
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
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined">person</span>
                                                </div>
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
                                                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                                    <span className="material-symbols-outlined">videocam</span>
                                                </div>
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
                    )}

                    {view === 'monthly' && (
                        <div className="h-full bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                    <div key={day} className="py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{day}</div>
                                ))}
                            </div>
                            <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
                                {monthlyDays.map((dayData, i) => (
                                    <div key={i} className={`border-r border-b border-slate-100 p-3 hover:bg-slate-50 transition-colors ${!dayData.inMonth ? 'bg-slate-50/30 text-slate-300' : ''} ${dayData.isToday ? 'bg-primary/5/20' : ''}`}>
                                        {dayData.inMonth && (
                                            <>
                                                <span className={`text-sm font-bold ${dayData.isToday ? 'text-primary bg-white w-6 h-6 flex items-center justify-center rounded-full shadow-sm ring-1 ring-blue-100' : 'text-slate-900'}`}>
                                                    {dayData.day}
                                                </span>
                                                {dayData.isToday && (
                                                    <span className="text-[8px] font-black text-primary uppercase block mt-1">Today</span>
                                                )}
                                                {dayData.appointments && dayData.appointments.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {dayData.appointments.map((appt, j) => (
                                                            <div key={j} className={`text-[10px] px-1.5 py-0.5 rounded font-bold border-l-2 truncate ${
                                                                appt.type === 'primary' ? 'bg-primary text-white' :
                                                                appt.type === 'blue' ? 'bg-primary/5 text-primary border-blue-600' :
                                                                appt.type === 'emerald' ? 'bg-success/10 text-success border-emerald-600' :
                                                                appt.type === 'dots' ? 'flex gap-1 p-1' :
                                                                ''
                                                            }`}>
                                                                {appt.type === 'dots' ? (
                                                                    <div className="flex gap-1">
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                                                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                                                    </div>
                                                                ) : (
                                                                    <>{appt.time} {appt.name}</>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <button onClick={() => navigate('/doctor-consultation')} className="fixed bottom-8 right-8 flex items-center gap-3 px-6 py-4 bg-primary-hover text-white rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 z-50">
                <span className="material-symbols-outlined" style={{ fontWeight: 700 }}>add</span>
                <span className="font-bold text-sm tracking-tight">Start New Consultation</span>
            </button>
        </div>
    );
}
