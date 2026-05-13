/**
 * DayView — single-day schedule with hour rows, NOW indicator, and appointment cards.
 */
import { motion } from 'framer-motion';
import { same, fmtH, fmtHM } from './calendarUtils';
import {
    HOUR_HEIGHT,
    START_HOUR,
    END_HOUR,
    HOURS,
    DSM,
    IconBtn,
} from './calendarConstants';

export default function DayView({
    dayDate,
    today,
    dayAppts,
    nowPx,
    onShiftDay,
}) {
    const isToday = same(dayDate, today);

    return (
        <>
            {/* Heading + navigation */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {isToday
                            ? `${dayAppts.length} appointments scheduled for today`
                            : 'Navigate to today to see appointments.'}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <IconBtn icon="chevron_left"  onClick={() => onShiftDay(-1)} />
                    <IconBtn icon="chevron_right" onClick={() => onShiftDay(1)}  />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
                {/* Current-time red line */}
                {isToday && nowPx !== null && (
                    <div
                        className="absolute left-0 right-0 flex items-center z-30 pointer-events-none"
                        style={{ top: nowPx }}
                    >
                        <div className="w-20 flex justify-end pr-3">
                            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded leading-none">NOW</span>
                        </div>
                        <div className="flex-1 h-0.5 bg-red-500" />
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                    </div>
                )}

                <div className="divide-y divide-slate-100">
                    {HOURS.map((h, hi) => {
                        const appt    = isToday ? dayAppts.find(a => a.startH === h) : null;
                        const isLunch = h === 12;
                        const s       = appt ? (DSM[appt.sn] ?? DSM.confirmed) : null;
                        const endMin  = appt ? appt.startH * 60 + appt.startM + appt.dur : 0;

                        return (
                            <motion.div
                                key={h}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: hi * 0.04, duration: 0.25 }}
                                className={`flex min-h-[100px] group ${isLunch ? 'bg-slate-50/60' : ''}`}
                            >
                                {/* Time label */}
                                <div className="w-20 pt-4 px-4 text-right shrink-0">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isLunch ? 'text-slate-300' : 'text-slate-400'}`}>
                                        {fmtH(h)}
                                    </span>
                                </div>

                                {/* Slot content */}
                                <div className="flex-1 p-4 border-l border-slate-100">
                                    {isLunch ? (
                                        <div className="flex items-center h-full">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                                                Staff Lunch Break
                                            </span>
                                        </div>

                                    ) : appt && s ? (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            whileHover={{ scale: 1.01 }}
                                            className={`rounded-xl p-4 cursor-pointer ${s.card}`}
                                        >
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-black uppercase tracking-tight ${s.time}`}>
                                                        {fmtHM(appt.startH, appt.startM)} – {fmtHM(Math.floor(endMin / 60), endMin % 60)}
                                                    </p>
                                                    <h4 className={`font-black mt-0.5 truncate ${s.name}`}>{appt.patient}</h4>
                                                    <p className={`text-xs mt-0.5 ${s.type}`}>{appt.type}</p>
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${s.badge}`}>
                                                    {appt.status === 'In Progress' && (
                                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                    )}
                                                    {appt.status}
                                                </span>
                                            </div>
                                        </motion.div>

                                    ) : (
                                        <div className="flex items-center h-full">
                                            <span className="text-xs text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                                + Add appointment
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
