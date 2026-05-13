/**
 * DoctorAppointmentsPage — orchestrator for the doctor's multi-view calendar.
 *
 * Composes: DoctorDailyView, DoctorWeeklyView, DoctorMonthlyView.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layouts/DashboardLayout';

import { appointmentService } from '@/services/appointments';
import { doctorService } from '@/services/doctors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { normalizeAppointments } from '@/lib/appointments';
import { getErrorMessage } from '@/lib/errors';
import { formatClinicTime, isSameClinicDay, parseClinicDateTime } from '@/lib/time';

import DoctorDailyView from '@clinic-ops/components/doctor/DoctorDailyView';
import DoctorWeeklyView from '@clinic-ops/components/doctor/DoctorWeeklyView';
import DoctorMonthlyView from '@clinic-ops/components/doctor/DoctorMonthlyView';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorAppointmentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState('daily');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [weeklyAppointments, setWeeklyAppointments] = useState([]);
    const [monthlyDays, setMonthlyDays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [cancelConfirmId, setCancelConfirmId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancellingId, setCancellingId] = useState(null);
    const { user } = useAuth();
    const { showToast } = useToast();

    const doctorUser = user ? {
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        role: user.role === 'doctor' ? 'Chief Resident' : 'Doctor',
        initials: `${user.first_name?.[0]||''}${user.last_name?.[0]||''}`.toUpperCase(),
        department: 'General Practice'
    } : { name: 'Doctor', role: 'Doctor', initials: '??', department: '—' };

    /* ── Data fetching & view derivation ── */
    useEffect(() => {
        let sub = null;
        let isMounted = true;

        const applyAppointments = (records = []) => {
            const normalizedData = normalizeAppointments(records);

            // Daily
            const dailyData = normalizedData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, currentDate));
            const mappedDaily = dailyData.map(a => {
                const timeDisplay = formatClinicTime(a.scheduled_at, { hour: 'numeric', minute: '2-digit' });
                const [time = '', timePeriod = ''] = timeDisplay.split(' ');
                return {
                    id: a.id, name: a.patientName, initials: a.patientInitials,
                    time, timePeriod,
                    type: a.reason || 'Consultation', reason: a.reason || '',
                    status: a.statusLabel || 'Scheduled', room: 'Room 101',
                    cancelled: a.isCancelled
                };
            });
            setAppointments(mappedDaily);

            // Weekly
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
                    duration: a.duration_minutes || 30,
                    name: a.patientName, type: a.reason || 'Consult',
                    color: 'bg-primary-hover', colorClass: 'border-blue-400'
                };
            });
            setWeeklyAppointments(mappedWeekly);

            // Monthly
            const y = currentDate.getFullYear();
            const m = currentDate.getMonth();
            const first = new Date(y, m, 1).getDay();
            const total = new Date(y, m + 1, 0).getDate();
            const prevTotal = new Date(y, m, 0).getDate();

            const mDays = [];
            for (let i = first - 1; i >= 0; i--) mDays.push({ day: prevTotal - i, inMonth: false });
            for (let i = 1; i <= total; i++) {
                const d = new Date(y, m, i);
                const apptsForDay = normalizedData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, d));
                mDays.push({
                    day: i, inMonth: true,
                    isToday: d.toLocaleDateString('en-US') === new Date().toLocaleDateString('en-US'),
                    appointments: apptsForDay.map(a => {
                        const ad = parseClinicDateTime(a.scheduled_at);
                        return { time: `${ad.getHours() % 12 || 12}:${ad.getMinutes().toString().padStart(2, '0')}`, name: a.patientName || 'Patient', type: 'blue' };
                    }).slice(0, 3)
                });
            }
            let nextDay = 1;
            while (mDays.length % 7 !== 0) mDays.push({ day: nextDay++, inMonth: false });
            setMonthlyDays(mDays);
        };

        const fetchAppointments = async (doctorId) => {
            const { data, error } = await appointmentService.getByDoctorId(doctorId);
            if (!isMounted) return;
            if (error) { setLoadError(getErrorMessage(error, 'Unable to load appointments.')); applyAppointments([]); return; }
            setLoadError(null);
            applyAppointments(data || []);
        };

        const fetchData = async () => {
            setLoading(true);
            if (!user?.id) { applyAppointments([]); setLoadError('Unable to resolve the logged-in doctor.'); setLoading(false); return; }
            const { data: doctor, error } = await doctorService.getByUserId(user.id);
            if (!isMounted) return;
            if (error || !doctor?.id) { applyAppointments([]); setLoadError('Unable to resolve the logged-in doctor profile.'); setLoading(false); return; }
            await fetchAppointments(doctor.id);
            if (!isMounted) return;
            sub = appointmentService.subscribeToAppointments(doctor.id, () => fetchAppointments(doctor.id));
            setLoading(false);
        };
        fetchData();

        return () => { isMounted = false; if (sub) sub.unsubscribe(); };
    }, [currentDate, user?.id, refreshKey]);

    /* ── Cancel handlers ── */
    const closeCancelConfirmation = () => { setCancelConfirmId(null); setCancelReason(''); };

    const handleCancelAppointment = async (appointmentId, reason) => {
        if (!reason?.trim()) { showToast('Please add a cancellation reason', 'error'); return; }
        try {
            setCancellingId(appointmentId);
            const { error } = await appointmentService.cancel(appointmentId, reason.trim());
            if (error) { showToast(getErrorMessage(error, 'Failed to cancel appointment'), 'error'); return; }
            showToast('Appointment cancelled', 'success');
            closeCancelConfirmation();
            setRefreshKey((c) => c + 1);
        } catch (error) {
            showToast(getErrorMessage(error, 'Failed to cancel appointment'), 'error');
        } finally { setCancellingId(null); }
    };

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

    /* ── Date helpers ── */
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const formatWeeklyDate = () => {
        const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay() + 1);
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };
    const formatMonthlyDate = () => currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const goToPrevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
    const goToNextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
    const goToPrevMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); };
    const goToNextMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); };
    const goToToday = () => { setCurrentDate(new Date()); setView('daily'); };

    return (
        <DashboardLayout role="doctor">
            <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-4 flex-1 max-w-xl">
                    <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search appointments, patients..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg mr-4">
                        {[['daily', 'Day'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, label]) => (
                            <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === v ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary'}`}>{label}</button>
                        ))}
                    </div>
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined">notifications</span></button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined">settings</span></button>
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
                {/* View header */}
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
                            <h2 className="text-[30px] font-black tracking-tight text-slate-900 leading-tight">Weekly Schedule</h2>
                            <p className="text-slate-500 font-medium text-sm">{formatWeeklyDate()}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={goToPrevWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                            <button onClick={goToToday} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">Today</button>
                            <button onClick={goToNextWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
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

                {loadError && (
                    <div className="mb-6 rounded-xl border border-critical/20 bg-critical/5 px-4 py-3 text-sm font-semibold text-critical">{loadError}</div>
                )}

                {/* View content */}
                {view === 'daily' && (
                    <DoctorDailyView
                        appointments={appointments}
                        cancelConfirmId={cancelConfirmId}
                        cancelReason={cancelReason}
                        cancellingId={cancellingId}
                        onCancelOpen={(id) => { setCancelConfirmId(id); setCancelReason(''); }}
                        onCancelKeep={closeCancelConfirmation}
                        onCancelReasonChange={setCancelReason}
                        onCancelConfirm={handleCancelAppointment}
                        getAvatarColor={getAvatarColor}
                    />
                )}
                {view === 'weekly' && <DoctorWeeklyView weeklyAppointments={weeklyAppointments} />}
                {view === 'monthly' && <DoctorMonthlyView monthlyDays={monthlyDays} />}
            </div>
        </DashboardLayout>
    );
}
