/**
 * WeekView — 7-column time-grid showing one ISO week of appointments.
 */
import { motion } from 'framer-motion';
import { same, fmtH, fmtHM, weekNum, toWeekIdx } from './calendarUtils';
import {
    MONTH_NAMES,
    WEEK_DAYS,
    HOUR_HEIGHT,
    START_HOUR,
    END_HOUR,
    HOURS,
    WSM,
    IconBtn,
} from './calendarConstants';

export default function WeekView({
    wkStart,
    today,
    weekAppts,
    onShiftWeek,
}) {
    const wkDays     = Array.from({ length: 7 }, (_, i) => { const d = new Date(wkStart); d.setDate(d.getDate() + i); return d; });
    const wkEnd      = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6);
    const wkHasToday = today >= wkStart && today <= wkEnd;
    const todayWkIdx = toWeekIdx(today.getDay());
    const totalGridH = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    const wkLabel = wkDays[0].getMonth() === wkDays[6].getMonth()
        ? `${MONTH_NAMES[wkDays[0].getMonth()]} ${wkDays[0].getDate()} – ${wkDays[6].getDate()}, ${wkDays[0].getFullYear()}`
        : `${MONTH_NAMES[wkDays[0].getMonth()]} ${wkDays[0].getDate()} – ${MONTH_NAMES[wkDays[6].getMonth()]} ${wkDays[6].getDate()}, ${wkDays[6].getFullYear()}`;

    return (
        <>
            {/* Heading + navigation */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{wkLabel}</h1>
                    <p className="text-slate-500 mt-1">
                        Week {weekNum(wkStart)} · {weekAppts.length} appointments scheduled
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <IconBtn icon="chevron_left"  onClick={() => onShiftWeek(-1)} />
                    <IconBtn icon="chevron_right" onClick={() => onShiftWeek(1)}  />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Day-of-week headers */}
                <div className="flex border-b border-slate-100">
                    <div className="w-16 shrink-0 border-r border-slate-100 bg-slate-50" />
                    {wkDays.map((d, i) => {
                        const isTod = same(d, today);
                        return (
                            <div
                                key={i}
                                className={`flex-1 p-4 text-center border-r border-slate-100 last:border-r-0 bg-slate-50 ${isTod ? '!bg-primary/5' : ''}`}
                            >
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isTod ? 'text-primary' : 'text-slate-400'}`}>
                                    {WEEK_DAYS[i]}
                                </p>
                                <p className={`text-xl font-black mt-1 ${isTod ? 'text-primary' : 'text-slate-700'}`}>
                                    {d.getDate()}
                                </p>
                                {isTod && <div className="mx-auto w-1.5 h-1.5 bg-primary rounded-full mt-1" />}
                            </div>
                        );
                    })}
                </div>

                {/* Scrollable time grid */}
                <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
                    <div className="relative" style={{ height: totalGridH, minWidth: 700 }}>

                        {/* Horizontal hour lines + time labels */}
                        {HOURS.map((h, i) => (
                            <div
                                key={h}
                                className="absolute left-0 right-0 border-b border-slate-50 flex items-start"
                                style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                            >
                                <div className="w-16 shrink-0 pt-2 px-3 text-right">
                                    <span className="text-[10px] font-bold text-slate-400">{fmtH(h)}</span>
                                </div>
                            </div>
                        ))}

                        {/* 7 day columns + absolute-positioned appointments */}
                        <div className="absolute inset-0 left-16 grid grid-cols-7">
                            {Array.from({ length: 7 }).map((_, dayIdx) => {
                                const colAppts   = weekAppts.filter(a => a.dayIdx === dayIdx);
                                const isTodayCol = wkHasToday && dayIdx === todayWkIdx;
                                return (
                                    <div
                                        key={dayIdx}
                                        className={`relative border-l border-slate-50 ${isTodayCol ? 'bg-primary/[0.025]' : ''}`}
                                    >
                                        {colAppts.map((appt, ai) => {
                                            const top    = (appt.startH - START_HOUR) * HOUR_HEIGHT + (appt.startM / 60) * HOUR_HEIGHT;
                                            const height = Math.max((appt.dur / 60) * HOUR_HEIGHT, 44);
                                            const s      = WSM[appt.style] ?? WSM.light;
                                            return (
                                                <motion.div
                                                    key={ai}
                                                    initial={{ opacity: 0, scale: 0.93 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: ai * 0.06, duration: 0.25 }}
                                                    whileHover={{ scale: 1.03, zIndex: 50 }}
                                                    className={`absolute mx-1 rounded-xl p-2.5 cursor-pointer z-10 border overflow-hidden ${s.card}`}
                                                    style={{ top, height, left: 0, right: 0 }}
                                                >
                                                    <p className={`text-[9px] font-black uppercase tracking-wider ${s.time}`}>
                                                        {fmtHM(appt.startH, appt.startM)}
                                                    </p>
                                                    <p className={`font-bold text-[13px] mt-0.5 truncate leading-tight ${s.name}`}>
                                                        {appt.patient}
                                                    </p>
                                                    {height > 65 && (
                                                        <p className={`text-[11px] truncate mt-0.5 ${s.type}`}>{appt.type}</p>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
