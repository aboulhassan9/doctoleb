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
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { useAppointments } from '@core/hooks/features/useAppointments';

/* ── Calendar sub-components ── */
import { weekStart, same, toWeekIdx } from '@clinic-ops/components/appointments/calendar/calendarUtils';
import { HOUR_HEIGHT, START_HOUR, END_HOUR } from '@clinic-ops/components/appointments/calendar/calendarConstants';
import MonthView from '@clinic-ops/components/appointments/calendar/MonthView';
import WeekView  from '@clinic-ops/components/appointments/calendar/WeekView';
import DayView   from '@clinic-ops/components/appointments/calendar/DayView';
import TodayScheduleSidebar from '@clinic-ops/components/appointments/TodayScheduleSidebar';
import ScheduleAppointmentModal from '@clinic-ops/components/appointments/ScheduleAppointmentModal';

/* ═══════════════════════════════════════════════════════════
   Main page component
═══════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /* ── State ── */
    const [monthAppts, setMonthAppts]       = useState({});
    const [weekAppts, setWeekAppts]         = useState([]);
    const [dayAppts, setDayAppts]           = useState([]);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const { raw: rawAppointments, loading: isLoadingAppts } = useAppointments({ mode: 'all' });

    const [view,      setView]      = useState('Month');
    const [viewYear,  setViewYear]  = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [wkStart,   setWkStart]   = useState(() => weekStart(now));
    const [dayDate,   setDayDate]   = useState(today);
    const [nowPx,     setNowPx]     = useState(null);
    const [showModal, setShowModal] = useState(false);

    /* ── Transform raw appointment data into view-specific structures ── */
    useEffect(() => {
        if (!rawAppointments) return;
        const mAppts = {};
        const wAppts = [];
        const dAppts = [];
        const tSchedule = [];

        rawAppointments.forEach(appt => {
            if (!appt.appointment_time) return;
            const date = new Date(appt.appointment_time);
            const y = date.getFullYear();
            const m = date.getMonth();
            const d = date.getDate();
            const h = date.getHours();
            const min = date.getMinutes();
            const dateKey = `${y}-${m + 1}-${d}`;
            const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const patientName = appt.patients?.users ? `${appt.patients.users.first_name} ${appt.patients.users.last_name}` : 'Unknown';
            const type = appt.reason_for_visit || 'Consultation';

            if (!mAppts[dateKey]) mAppts[dateKey] = [];
            mAppts[dateKey].push({ time: timeStr, patient: patientName, cls: 'bg-primary/10 text-primary border-l-2 border-primary' });

            const dayIdx = date.getDay();
            const wkDayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
            wAppts.push({ dayIdx: wkDayIdx, startH: h, startM: min, dur: 60, patient: patientName, type, style: 'primary' });

            dAppts.push({ startH: h, startM: min, dur: 60, patient: patientName, type, status: appt.status || 'Confirmed', sn: 'confirmed' });

            if (y === today.getFullYear() && m === today.getMonth() && d === today.getDate()) {
                tSchedule.push({ time: timeStr, patient: patientName, type, status: appt.status || 'Pending', sc: 'bg-primary/10 text-primary', cc: 'bg-white border border-slate-100' });
            }
        });
        setMonthAppts(mAppts);
        setWeekAppts(wAppts);
        setDayAppts(dAppts);
        setTodaySchedule(tSchedule);
    }, [rawAppointments]);

    /* ── Open modal from navigation state (e.g. "Schedule" button on another page) ── */
    const location = useLocation();
    useEffect(() => {
        if (location.state?.openScheduleModal) {
            setShowModal(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

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
    const prevMonth = () => viewMonth === 0  ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
    const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0))  : setViewMonth(m => m + 1);
    const shiftWeek = n  => setWkStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + n * 7); return nd; });
    const shiftDay  = n  => setDayDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + n);     return nd; });

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
                                    onClick={() => setView(v)}
                                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                        view === v ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowModal(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Schedule Appointment
                    </motion.button>
                </header>

                {/* ─────────────── Body ─────────────── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ──────── Main calendar area ──────── */}
                    <div className="flex-1 overflow-y-auto p-8">
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
                                        monthAppts={monthAppts}
                                        onPrevMonth={prevMonth}
                                        onNextMonth={nextMonth}
                                    />
                                )}

                                {view === 'Week' && (
                                    <WeekView
                                        wkStart={wkStart}
                                        today={today}
                                        weekAppts={weekAppts}
                                        onShiftWeek={shiftWeek}
                                    />
                                )}

                                {view === 'Day' && (
                                    <DayView
                                        dayDate={dayDate}
                                        today={today}
                                        dayAppts={dayAppts}
                                        nowPx={nowPx}
                                        onShiftDay={shiftDay}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* ──────── Today's Schedule sidebar ──────── */}
                    <TodayScheduleSidebar
                        todaySchedule={todaySchedule}
                        onScheduleClick={() => setShowModal(true)}
                    />
                </div>
            </div>

            {/* ── Schedule appointment modal ── */}
            <AnimatePresence>
                {showModal && <ScheduleAppointmentModal onClose={() => setShowModal(false)} />}
            </AnimatePresence>
        </DashboardLayout>
    );
}
