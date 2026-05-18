/**
 * DoctorAppointmentsPage — orchestrator for the doctor's multi-view calendar.
 *
 * Composes: DoctorDailyView, DoctorWeeklyView, DoctorMonthlyView.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';

import { appointmentService } from '@/services/appointments';
import { doctorService } from '@/services/doctors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useNotifications } from '@/hooks/features/useNotifications';
import { normalizeAppointmentViewModels } from '@/lib/clinicOpsAppointments';
import { getClinicOpsNotificationTarget, normalizeClinicOpsAppointmentView } from '@/lib/clinicOpsNavigation';
import { timeAgo } from '@/lib/dateUtils';
import { getErrorMessage } from '@/lib/errors';
import { formatClinicTime, isSameClinicDay, parseClinicDateTime } from '@/lib/time';

import DoctorDailyView from '@clinic-ops/components/doctor/DoctorDailyView';
import DoctorWeeklyView from '@clinic-ops/components/doctor/DoctorWeeklyView';
import DoctorMonthlyView from '@clinic-ops/components/doctor/DoctorMonthlyView';
import AppointmentDetailsDrawer from '@clinic-ops/components/appointments/AppointmentDetailsDrawer';

export default function DoctorAppointmentsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialDateParam = searchParams.get('date');
    const parsedInitialDate = initialDateParam ? new Date(`${initialDateParam}T00:00:00`) : new Date();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [view, setView] = useState(normalizeClinicOpsAppointmentView(searchParams.get('view') || 'day'));
    const [currentDate, setCurrentDate] = useState(Number.isNaN(parsedInitialDate.getTime()) ? new Date() : parsedInitialDate);
    const [showNotifications, setShowNotifications] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [allAppointmentRecords, setAllAppointmentRecords] = useState([]);
    const [weeklyAppointments, setWeeklyAppointments] = useState([]);
    const [monthlyDays, setMonthlyDays] = useState([]);
    const [monthlyAppointmentCount, setMonthlyAppointmentCount] = useState(0);
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [weeklyCompletedCount, setWeeklyCompletedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [cancelConfirmId, setCancelConfirmId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancellingId, setCancellingId] = useState(null);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const { user } = useAuth();
    const { showToast } = useToast();
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications({ userId: user?.id });

    const doctorUser = user ? {
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        role: user.role === 'doctor' ? 'Chief Resident' : 'Doctor',
        initials: `${user.first_name?.[0]||''}${user.last_name?.[0]||''}`.toUpperCase(),
        department: 'General Practice'
    } : { name: 'Doctor', role: 'Doctor', initials: '??', department: '—' };

    const updateParams = (patch) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            Object.entries(patch).forEach(([key, value]) => {
                if (value === null || value === undefined || value === '') next.delete(key);
                else next.set(key, String(value));
            });
            return next;
        });
    };

    const setDateAndView = (date, nextView = view) => {
        const normalizedView = normalizeClinicOpsAppointmentView(nextView);
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        setCurrentDate(normalized);
        setView(normalizedView);
        updateParams({ date: normalized.toISOString().slice(0, 10), view: normalizedView });
    };

    const setCalendarView = (nextView) => {
        const normalizedView = normalizeClinicOpsAppointmentView(nextView);
        setView(normalizedView);
        updateParams({ view: normalizedView });
    };

    /* ── Data fetching & view derivation ── */
    useEffect(() => {
        let sub = null;
        let isMounted = true;

        const applyAppointments = (records = []) => {
            const normalizedData = normalizeAppointmentViewModels(records, { role: 'doctor' });
            setAllAppointmentRecords(normalizedData);
            const q = searchQuery.trim().toLowerCase();
            const visibleData = normalizedData.filter((a) => {
                if (!q) return true;
                return [a.patient.name, a.doctor.name, a.clinic.label, a.reason, a.statusLabel, a.id]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(q);
            });

            // Daily
            const dailyData = visibleData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, currentDate));
            const mappedDaily = dailyData.map(a => {
                const timeDisplay = formatClinicTime(a.scheduled_at, { hour: 'numeric', minute: '2-digit' });
                const [time = '', timePeriod = ''] = timeDisplay.split(' ');
                return {
                    id: a.id,
                    name: a.patient.name,
                    initials: a.patient.initials,
                    patientId: a.patient_id,
                    scheduled_at: a.scheduled_at,
                    time, timePeriod,
                    type: a.reason || 'Consultation', reason: a.reason || '',
                    status: a.statusLabel || 'Scheduled',
                    room: a.clinic.label,
                    rawStatus: a.status,
                    cancelled: a.isCancelled,
                    allowedActions: a.allowedActions,
                    record: a,
                };
            });
            setAppointments(mappedDaily);
            setTodayAppointments(visibleData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, new Date())));

            // Weekly
            const start = new Date(currentDate);
            start.setDate(start.getDate() - start.getDay() + 1);
            start.setHours(0,0,0,0);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            end.setHours(23,59,59,999);

            const weeklyData = visibleData.filter(a => {
                if(!a.scheduled_at) return false;
                const d = parseClinicDateTime(a.scheduled_at);
                return d >= start && d <= end;
            });
            setWeeklyCompletedCount(weeklyData.filter(a => a.status === 'completed').length);
            const mappedWeekly = weeklyData.map(a => {
                const d = parseClinicDateTime(a.scheduled_at);
                return {
                    id: a.id,
                    patientId: a.patient_id,
                    day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
                    date: d.getDate(),
                    time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
                    duration: a.duration_minutes || 30,
                    name: a.patient.name,
                    type: a.reason || 'Consult',
                    rawStatus: a.status,
                    color: a.status === 'cancelled' ? 'bg-slate-100' : 'bg-primary-hover',
                    colorClass: a.status === 'cancelled' ? 'border-slate-300' : 'border-blue-400',
                    textDark: a.status === 'cancelled',
                    record: a,
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
                const apptsForDay = visibleData.filter(a => a.scheduled_at && isSameClinicDay(a.scheduled_at, d));
                mDays.push({
                    date: d.toISOString(),
                    day: i, inMonth: true,
                    isToday: d.toLocaleDateString('en-US') === new Date().toLocaleDateString('en-US'),
                    appointments: apptsForDay.map(a => {
                        const ad = parseClinicDateTime(a.scheduled_at);
                        return { id: a.id, patientId: a.patient_id, time: `${ad.getHours() % 12 || 12}:${ad.getMinutes().toString().padStart(2, '0')}`, name: a.patient.name || 'Patient', type: a.status === 'cancelled' ? 'emerald' : 'blue', record: a };
                    }).slice(0, 3)
                });
            }
            let nextDay = 1;
            while (mDays.length % 7 !== 0) mDays.push({ day: nextDay++, inMonth: false });
            setMonthlyDays(mDays);
            setMonthlyAppointmentCount(visibleData.filter(a => {
                if (!a.scheduled_at) return false;
                const d = parseClinicDateTime(a.scheduled_at);
                return d.getFullYear() === y && d.getMonth() === m;
            }).length);
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
    }, [currentDate, user?.id, refreshKey, searchQuery]);

    useEffect(() => {
        const appointmentId = searchParams.get('appointmentId');
        if (!appointmentId || selectedAppointment?.id === appointmentId) return;
        const match = allAppointmentRecords.find(item => item.id === appointmentId);
        if (!match) return;
        setSelectedAppointment(match);
        if (match.scheduledAt) {
            setDateAndView(new Date(match.scheduledAt), 'day');
        }
    }, [allAppointmentRecords, searchParams, selectedAppointment?.id]);

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
        const colors = [
            'bg-primary/10 text-primary',
            'bg-pink-100 text-pink-700',
            'bg-warning/10 text-warning',
            'bg-success/10 text-success',
            'bg-secondary/10 text-secondary',
            'bg-slate-100 text-slate-700',
        ];
        const seed = String(name || 'patient').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return colors[seed % colors.length];
    };

    /* ── Date helpers ── */
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const formatWeeklyDate = () => {
        const start = new Date(currentDate); start.setDate(start.getDate() - start.getDay() + 1);
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };
    const formatMonthlyDate = () => currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const goToPrevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setDateAndView(d, 'week'); };
    const goToNextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setDateAndView(d, 'week'); };
    const goToPrevMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setDateAndView(d, 'month'); };
    const goToNextMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setDateAndView(d, 'month'); };
    const goToToday = () => { setDateAndView(new Date(), 'day'); };
    const handleSearchSubmit = (event) => {
        event.preventDefault();
        updateParams({ q: searchQuery.trim() || null });
    };
    const handleNotificationClick = async (notification) => {
        await markRead(notification.id);
        setShowNotifications(false);
        navigate(getClinicOpsNotificationTarget(notification, 'doctor'));
    };
    const handleAppointmentOpen = (appointmentId) => {
        if (!appointmentId) return;
        const appointment = allAppointmentRecords.find(item => item?.id === appointmentId);
        if (appointment) {
            setSelectedAppointment(appointment);
            updateParams({ appointmentId });
            return;
        }
        updateParams({ appointmentId });
    };
    const closeAppointmentDrawer = () => {
        setSelectedAppointment(null);
        setCancelReason('');
        updateParams({ appointmentId: null });
    };
    const openSelectedEncounter = () => {
        if (!selectedAppointment?.id || !selectedAppointment.allowedActions?.openEncounter?.enabled) return;
        navigate(`/doctor-encounter/${selectedAppointment.id}`);
    };

    return (
        <DashboardLayout role="doctor">
            <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-4 flex-1 max-w-xl">
                    <form className="relative w-full" onSubmit={handleSearchSubmit}>
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                        <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); updateParams({ q: e.target.value.trim() || null }); }} placeholder="Search appointments, patients..." className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" />
                    </form>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg mr-4">
                        {[['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([v, label]) => (
                            <button key={v} type="button" onClick={() => setCalendarView(v)} className={`px-4 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === v ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-primary'}`}>{label}</button>
                        ))}
                    </div>
                    <div className="relative">
                        <button type="button" onClick={() => setShowNotifications(value => !value)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary relative" aria-label="Open notifications">
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-critical px-1 text-[10px] font-black text-white flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                        {showNotifications && (
                            <div className="absolute right-0 top-[120%] z-50 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                                    <span className="text-sm font-black text-slate-900">Notifications</span>
                                    <button type="button" onClick={markAllRead} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Mark all read</button>
                                </div>
                                <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                                    {notifications.length === 0 ? (
                                        <div className="p-6 text-center text-sm font-medium text-slate-400">All caught up.</div>
                                    ) : notifications.map(notification => (
                                        <button key={notification.id} type="button" onClick={() => handleNotificationClick(notification)} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20">
                                            <span className="material-symbols-outlined mt-1 rounded-lg bg-primary/10 p-2 text-[16px] text-primary">notifications</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-black text-slate-900">{notification.title}</span>
                                                {notification.message && <span className="mt-0.5 block line-clamp-2 text-[11px] text-slate-500">{notification.message}</span>}
                                                <span className="mt-1 block text-[10px] font-bold text-slate-400">{timeAgo(notification.created_at)}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={() => navigate('/doctor-tenant-settings')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary" aria-label="Open settings"><span className="material-symbols-outlined">settings</span></button>
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
                {view === 'day' && (
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Appointments</h2>
                            <p className="text-slate-500 mt-2 text-base">{today} • <span className="text-primary font-bold">{appointments.filter(a => a.status !== 'Cancelled').length} Patients remaining</span></p>
                        </div>
                    </motion.div>
                )}
                {view === 'week' && (
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-end">
                        <div>
                            <h2 className="text-[30px] font-black tracking-tight text-slate-900 leading-tight">Weekly Schedule</h2>
                            <p className="text-slate-500 font-medium text-sm">{formatWeeklyDate()}</p>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={goToPrevWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                            <button type="button" onClick={goToToday} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">Today</button>
                            <button type="button" onClick={goToNextWeek} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                        </div>
                    </motion.div>
                )}
                {view === 'month' && (
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-end">
                        <div>
                            <h2 className="text-[30px] font-black tracking-tight text-slate-900">{formatMonthlyDate()}</h2>
                            <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                                <span className="material-symbols-outlined text-sm">event</span>
                                <span>{monthlyAppointmentCount} appointments this month</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={goToPrevMonth} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
                            <button type="button" onClick={goToToday} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">Today</button>
                            <button type="button" onClick={goToNextMonth} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
                        </div>
                    </motion.div>
                )}

                {loadError && (
                    <div className="mb-6 rounded-xl border border-critical/20 bg-critical/5 px-4 py-3 text-sm font-semibold text-critical">{loadError}</div>
                )}

                {/* View content */}
                {view === 'day' && (
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
                        currentDate={currentDate}
                        onDateSelect={(date) => setDateAndView(date, 'day')}
                        onAppointmentOpen={handleAppointmentOpen}
                    />
                )}
                {view === 'week' && (
                    <DoctorWeeklyView
                        weeklyAppointments={weeklyAppointments}
                        currentDate={currentDate}
                        todayAppointments={todayAppointments}
                        completedThisWeek={weeklyCompletedCount}
                        weeklyGoal={Math.max(weeklyAppointments.length, weeklyCompletedCount, 1)}
                        onAppointmentOpen={handleAppointmentOpen}
                        onViewAll={() => setDateAndView(new Date(), 'day')}
                        onEditPolicy={() => navigate('/doctor-schedule')}
                    />
                )}
                {view === 'month' && (
                    <DoctorMonthlyView
                        monthlyDays={monthlyDays}
                        onDateSelect={(date) => setDateAndView(date, 'day')}
                        onAppointmentOpen={handleAppointmentOpen}
                    />
                )}
            </div>
            {selectedAppointment && (
                <AppointmentDetailsDrawer
                    appointment={selectedAppointment}
                    onClose={closeAppointmentDrawer}
                    onViewPatient={() => selectedAppointment.patient?.id && navigate(`/doctor-patient/${selectedAppointment.patient.id}`)}
                    cancelReason={cancelReason}
                    cancelling={cancellingId === selectedAppointment.id}
                    onCancelReasonChange={setCancelReason}
                    onCancelConfirm={handleCancelAppointment}
                    primaryAction={
                        selectedAppointment.allowedActions?.openEncounter?.enabled
                            ? { label: selectedAppointment.allowedActions.openEncounter.label, onClick: openSelectedEncounter }
                            : null
                    }
                    disabledPrimaryReason={selectedAppointment.allowedActions?.openEncounter?.reason}
                />
            )}
        </DashboardLayout>
    );
}
