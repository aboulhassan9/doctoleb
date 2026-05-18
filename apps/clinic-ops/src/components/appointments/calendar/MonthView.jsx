/**
 * MonthView — grid calendar showing a full month with appointment chips.
 */
import { motion } from 'framer-motion';
import { monthCells } from './calendarUtils';
import { MONTH_NAMES, CAL_DAYS } from './calendarConstants';

export default function MonthView({
    viewYear,
    viewMonth,
    today,
    monthAppts,
    onPrevMonth,
    onNextMonth,
    onDaySelect,
    onAppointmentSelect,
}) {
    const cells  = monthCells(viewYear, viewMonth);
    const rows   = cells.length / 7;
    const thisMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Appointment Calendar</h1>
                <p className="text-slate-500 mt-1">View and manage clinic schedules.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-slate-900">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </h3>
                        <div className="flex gap-1">
                            {[['chevron_left', onPrevMonth], ['chevron_right', onNextMonth]].map(([icon, fn], i) => (
                                <motion.button key={i} whileHover={{ scale: 1.1 }} onClick={fn} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined text-slate-500 text-[20px]">{icon}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Weekday labels */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                    {CAL_DAYS.map(d => (
                        <div key={d} className="py-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${rows}, minmax(108px, 1fr))` }}>
                    {cells.map((day, idx) => {
                        const key   = day ? `${viewYear}-${viewMonth + 1}-${day}` : null;
                        const appts = key && monthAppts[key] ? monthAppts[key] : [];
                        const isToday = thisMonth && day === today.getDate();
                        return (
                            <div
                                key={idx}
                                onClick={() => day && onDaySelect?.(new Date(viewYear, viewMonth, day))}
                                role={day ? 'button' : undefined}
                                tabIndex={day ? 0 : undefined}
                                onKeyDown={(event) => {
                                    if (day && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        onDaySelect?.(new Date(viewYear, viewMonth, day));
                                    }
                                }}
                                className={`border-b p-2 flex flex-col ${idx % 7 === 6 ? '' : 'border-r'} border-slate-100 transition-colors
                                    ${!day ? 'bg-slate-50/40 cursor-default' : isToday ? 'bg-primary/5 text-left hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30' : 'bg-white text-left hover:bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-primary/20'}`}
                            >
                                {day && (
                                    <>
                                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1.5
                                            ${isToday ? 'bg-primary text-white shadow-md shadow-primary/30' : 'text-slate-600'}`}>
                                            {day}
                                        </span>
                                        <div className="flex flex-col gap-1 overflow-hidden">
                                            {appts.map((a, ai) => (
                                                <span
                                                    key={ai}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onAppointmentSelect?.(a.record || a);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            onAppointmentSelect?.(a.record || a);
                                                        }
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold truncate focus:outline-none focus:ring-2 focus:ring-primary/30 ${a.cls}`}
                                                >
                                                    {a.time} {a.patient}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
