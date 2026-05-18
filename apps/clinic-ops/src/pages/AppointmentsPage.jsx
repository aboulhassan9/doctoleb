/**
 * AppointmentsPage — orchestrator for the clinic appointment calendar.
 *
 * This page composes extracted sub-components:
 *  - MonthView, WeekView, DayView  (calendar grids)
 *  - TodayScheduleSidebar           (right-hand panel)
 *  - ScheduleAppointmentModal       (booking slide-over)
 *
 * All constants, utilities, and style maps live in:
 *  - components/appointments/calendar/calendarUtils.js
 *  - components/appointments/calendar/calendarConstants.jsx
 */
import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { useAppointments } from '@core/hooks/features/useAppointments';
import { appointmentService } from '@core/services/appointments';
import { normalizeClinicOpsAppointmentView } from '@core/lib/clinicOpsNavigation';
import { useToast } from '@ui/contexts/ToastContext';

/* ── Calendar sub-components ── */
import { weekStart, same, toDateKey } from '@clinic-ops/components/appointments/calendar/calendarUtils';
import { HOUR_HEIGHT, START_HOUR, END_HOUR } from '@clinic-ops/components/appointments/calendar/calendarConstants';
import MonthView from '@clinic-ops/components/appointments/calendar/MonthView';
import WeekView  from '@clinic-ops/components/appointments/calendar/WeekView';
import DayView   from '@clinic-ops/components/appointments/calendar/DayView';
import TodayScheduleSidebar from '@clinic-ops/components/appointments/TodayScheduleSidebar';
import ScheduleAppointmentModal from '@clinic-ops/components/appointments/ScheduleAppointmentModal';
import AppointmentDetailsDrawer from '@clinic-ops/components/appointments/AppointmentDetailsDrawer';

/* ═══════════════════════════════════════════════════════════
   Main page component
═══════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [today] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    });
    const dateParam = searchParams.get('date');
    const parsedInitialDate = dateParam ? new Date(`${dateParam}T00:00:00`) : today;
    const initialDate = Number.isNaN(parsedInitialDate.getTime()) ? today : parsedInitialDate;
    const initialViewParam = normalizeClinicOpsAppointmentView(searchParams.get('view') || 'month', 'month');
    const initialView = initialViewParam === 'week' ? 'Week' : initialViewParam === 'day' ? 'Day' : 'Month';

    /* ── State ── */
    const { appointments, loading: isLoadingAppts, refresh } = useAppointments({ mode: 'all' });

    const [view,      setView]      = useState(initialView);
    const [viewYear,  setViewYear]  = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
    const [wkStart,   setWkStart]   = useState(() => weekStart(initialDate));
    const [dayDate,   setDayDate]   = useState(initialDate);
    const [nowPx,     setNowPx]     = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [bookingDefaults, setBookingDefaults] = useState({});
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');

    const updateParams = (patch) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            Object.entries(patch).forEach(([key, value]) => {
                if (value === null || value === undefined || value === '' || value === 'all') next.delete(key);
                else next.set(key, String(value));
            });
            return next;
        });
    };

    const setCalendarView = (nextView) => {
        setView(nextView);
        updateParams({ view: nextView.toLowerCase() });
    };

    const selectDate = (date, nextView = 'Day') => {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        setDayDate(normalized);
        setWkStart(weekStart(normalized));
        setViewYear(normalized.getFullYear());
        setViewMonth(normalized.getMonth());
        setView(nextView);
        updateParams({ view: nextView.toLowerCase(), date: toDateKey(normalized) });
    };

    const filteredAppointments = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return appointments.filter((appt) => {
            const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
            const haystack = [
                appt.patientName,
                appt.doctorName,
                appt.reason,
                appt.statusLabel,
                appt.id,
            ].filter(Boolean).join(' ').toLowerCase();
            return matchesStatus && (!q || haystack.includes(q));
        });
    }, [appointments, searchQuery, statusFilter]);

    const calendarData = useMemo(() => {
        const mAppts = {};
        const wAppts = [];
        const dAppts = [];
        const tSchedule = [];

        filteredAppointments.forEach(appt => {
            if (!appt.scheduled_at) return;
            const date = new Date(appt.scheduled_at);
            const y = date.getFullYear();
            const m = date.getMonth();
            const d = date.getDate();
            const h = date.getHours();
            const min = date.getMinutes();
            const dateKey = `${y}-${m + 1}-${d}`;
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const patientName = appt.patientName || 'Unknown Patient';
            const type = appt.reason || 'Consultation';
            const statusStyle = appt.status === 'cancelled'
                ? 'bg-critical/10 text-critical border-l-2 border-critical'
                : appt.status === 'completed'
                    ? 'bg-slate-100 text-slate-500 border-l-2 border-slate-300'
                    : 'bg-primary/10 text-primary border-l-2 border-primary';

            if (!mAppts[dateKey]) mAppts[dateKey] = [];
            mAppts[dateKey].push({ time: timeStr, patient: patientName, cls: statusStyle, record: appt });

            const dayIdx = date.getDay();
            const wkDayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            wAppts.push({ dayIdx: wkDayIdx, startH: h, startM: min, dur: appt.duration_minutes || 30, patient: patientName, type, style: appt.status === 'cancelled' ? 'light' : 'primary', record: appt });

            dAppts.push({ id: appt.id, startH: h, startM: min, dur: appt.duration_minutes || 30, patient: patientName, type, status: appt.statusLabel || 'Scheduled', sn: appt.status === 'cancelled' ? 'pending' : 'confirmed', record: appt });

            if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) {
                tSchedule.push({
                    time: timeStr,
                    patient: patientName,
                    type,
                    rawStatus: appt.status,
                    status: appt.statusLabel || 'Scheduled',
                    sc: 'bg-primary/10 text-primary',
                    cc: 'bg-white border border-slate-100',
                    record: appt,
                });
            }
        });

        return {
            monthAppts: mAppts,
            weekAppts: wAppts,
            dayAppts: dAppts.filter((appt) => same(new Date(appt.record.scheduled_at), dayDate)),
            todaySchedule: tSchedule,
        };
    }, [filteredAppointments, dayDate, today]);

    /* ── Open modal from navigation state (e.g. "Schedule" button on another page) ── */
    const location = useLocation();
    useEffect(() => {
        if (location.state?.openScheduleModal) {
            setShowModal(true);
            if (location.state?.date) {
                const date = new Date(`${location.state.date}T00:00:00`);
                setBookingDefaults({ initialDate: date });
                selectDate(date, 'Day');
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        const appointmentId = searchParams.get('appointmentId');
        if (!appointmentId || selectedAppointment?.id === appointmentId) return;
        const match = appointments.find((appt) => appt.id === appointmentId);
        if (match) {
            setSelectedAppointment(match);
            if (match.scheduled_at) selectDate(new Date(match.scheduled_at), 'Day');
        }
    }, [appointments, searchParams, selectedAppointment?.id]);

    /* ── Tick the NOW indicator every minute ── */
    useEffect(() => {
        const calc = () => {
            const n = new Date();
            const h = n.getHours(), m = n.getMinutes();
            setNowPx(h >= START_HOUR && h < END_HOUR
                ? (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT
                : null);
        };
        calc();
        const id = setInterval(calc, 60_000);
        return () => clearInterval(id);
    }, []);

    /* ── Navigation helpers ── */
    const prevMonth = () => {
        const nextDate = new Date(viewYear, viewMonth - 1, 1);
        setViewYear(nextDate.getFullYear());
        setViewMonth(nextDate.getMonth());
        updateParams({ date: toDateKey(nextDate), view: 'month' });
    };
    const nextMonth = () => {
        const nextDate = new Date(viewYear, viewMonth + 1, 1);
        setViewYear(nextDate.getFullYear());
        setViewMonth(nextDate.getMonth());
        updateParams({ date: toDateKey(nextDate), view: 'month' });
    };
    const shiftWeek = n => {
        const nd = new Date(wkStart);
        nd.setDate(nd.getDate() + n * 7);
        setWkStart(nd);
        updateParams({ date: toDateKey(nd), view: 'week' });
    };
    const shiftDay = n => {
        const nd = new Date(dayDate);
        nd.setDate(nd.getDate() + n);
        selectDate(nd, 'Day');
    };

    const openBookingForSlot = (slotDate) => {
        const date = new Date(slotDate);
        const initialTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        setBookingDefaults({ initialDate: date, initialTime });
        selectDate(date, 'Day');
        setShowModal(true);
    };

    const handleAppointmentSelect = (appointment) => {
        setSelectedAppointment(appointment);
        setCancelReason('');
        updateParams({ appointmentId: appointment?.id || null });
    };

    const handleCancelAppointment = async (appointmentId) => {
        if (!cancelReason.trim()) {
            showToast('Please add a cancellation reason first.', 'error');
            return;
        }
        try {
            setCancelling(true);
            const { error } = await appointmentService.cancel(appointmentId, cancelReason.trim());
            if (error) throw new Error(error?.message || error);
            showToast('Appointment cancelled.', 'success');
            setSelectedAppointment(null);
            setCancelReason('');
            updateParams({ appointmentId: null });
            await refresh();
        } catch (error) {
            showToast(error.message || 'Unable to cancel appointment.', 'error');
        } finally {
            setCancelling(false);
        }
    };

    const handleSearchChange = (value) => {
        setSearchQuery(value);
        updateParams({ q: value.trim() || null });
    };

    const handleStatusChange = (value) => {
        setStatusFilter(value);
        updateParams({ status: value });
    };

    return (
        <DashboardLayout role="secretary">
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ─────────────── Page header ─────────────── */}
                <header className="h-[68px] bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-xl">calendar_today</span>
                            <h2 className="text-slate-900 text-lg font-black tracking-tight">Appointment Calendar</h2>
                        </div>

                        {/* View switcher pill */}
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                            {['Month', 'Week', 'Day'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setCalendarView(v)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        view === v ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            value={searchQuery}
                            onChange={(event) => handleSearchChange(event.target.value)}
                            placeholder="Search patient, doctor, reason..."
                            className="hidden lg:block w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <select
                            value={statusFilter}
                            onChange={(event) => handleStatusChange(event.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="all">All statuses</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="pre_check">Pre-check</option>
                            <option value="in_consultation">In consultation</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no_show">No show</option>
                        </select>
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => {
                                setBookingDefaults({ initialDate: dayDate });
                                setShowModal(true);
                            }}
                            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Schedule Appointment
                        </motion.button>
                    </div>
                </header>

                {/* ─────────────── Body ─────────────── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ──────── Main calendar area ──────── */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {isLoadingAppts && (
                            <div className="mb-4 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary">
                                Loading live appointments...
                            </div>
                        )}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={view}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.18 }}
                            >
                                {view === 'Month' && (
                                    <MonthView
                                        viewYear={viewYear}
                                        viewMonth={viewMonth}
                                        today={today}
                                        monthAppts={calendarData.monthAppts}
                                        onPrevMonth={prevMonth}
                                        onNextMonth={nextMonth}
                                        onDaySelect={(date) => selectDate(date, 'Day')}
                                        onAppointmentSelect={handleAppointmentSelect}
                                    />
                                )}

                                {view === 'Week' && (
                                    <WeekView
                                        wkStart={wkStart}
                                        today={today}
                                        weekAppts={calendarData.weekAppts}
                                        onShiftWeek={shiftWeek}
                                        onSlotSelect={openBookingForSlot}
                                        onAppointmentSelect={handleAppointmentSelect}
                                    />
                                )}

                                {view === 'Day' && (
                                    <DayView
                                        dayDate={dayDate}
                                        today={today}
                                        dayAppts={calendarData.dayAppts}
                                        nowPx={nowPx}
                                        onShiftDay={shiftDay}
                                        onSlotSelect={openBookingForSlot}
                                        onAppointmentSelect={handleAppointmentSelect}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* ──────── Today's Schedule sidebar ──────── */}
                    <TodayScheduleSidebar
                        todaySchedule={calendarData.todaySchedule}
                        onScheduleClick={() => {
                            setBookingDefaults({ initialDate: today });
                            setShowModal(true);
                        }}
                        onAppointmentClick={handleAppointmentSelect}
                        dailyGoal={Math.max(1, calendarData.todaySchedule.length)}
                    />
                </div>
            </div>

            {/* ── Schedule appointment modal ── */}
            <AnimatePresence>
                {showModal && (
                    <ScheduleAppointmentModal
                        onClose={() => setShowModal(false)}
                        initialDate={bookingDefaults.initialDate}
                        initialTime={bookingDefaults.initialTime}
                        initialDoctorId={bookingDefaults.initialDoctorId}
                        onBooked={async (appointment) => {
                            await refresh();
                            if (appointment?.id) handleAppointmentSelect(appointment);
                        }}
                    />
                )}
                {selectedAppointment && (
                    <AppointmentDetailsDrawer
                        appointment={selectedAppointment}
                        onClose={() => {
                            setSelectedAppointment(null);
                            setCancelReason('');
                            updateParams({ appointmentId: null });
                        }}
                        onViewPatient={() => selectedAppointment.patient_id && navigate(`/patient-profile/${selectedAppointment.patient_id}`)}
                        cancelReason={cancelReason}
                        cancelling={cancelling}
                        onCancelReasonChange={setCancelReason}
                        onCancelConfirm={handleCancelAppointment}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
