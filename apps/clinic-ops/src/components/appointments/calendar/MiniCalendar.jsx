/**
 * MiniCalendar — compact date picker used inside the schedule modal.
 * Shows a single month with day cells; past dates are disabled.
 */
import { useState } from 'react';
import { monthCells, same } from './calendarUtils';
import { MONTH_NAMES } from './calendarConstants';

export default function MiniCalendar({ selected, onSelect }) {
    const now   = new Date();
    const [calendarYear,  setCalendarYear]  = useState(selected ? selected.getFullYear() : now.getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(selected ? selected.getMonth()    : now.getMonth());

    const cells = monthCells(calendarYear, calendarMonth);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const prevMonth = () =>
        calendarMonth === 0
            ? (setCalendarYear(y => y - 1), setCalendarMonth(11))
            : setCalendarMonth(m => m - 1);
    const nextMonth = () =>
        calendarMonth === 11
            ? (setCalendarYear(y => y + 1), setCalendarMonth(0))
            : setCalendarMonth(m => m + 1);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-slate-800">
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                </span>
                <div className="flex gap-1">
                    {[['chevron_left', prevMonth], ['chevron_right', nextMonth]].map(([icon, handler], i) => (
                        <button key={i} onClick={handler} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                            <span className="material-symbols-outlined text-slate-400 text-[18px]">{icon}</span>
                        </button>
                    ))}
                </div>
            </div>
            {/* Day labels */}
            <div className="grid grid-cols-7 text-center mb-1">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                    <span key={i} className="text-[9px] font-black text-slate-400 uppercase">{d}</span>
                ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const date     = new Date(calendarYear, calendarMonth, day);
                    const isSelected = selected && same(date, selected);
                    const isToday    = same(date, today);
                    const isPast     = date < today;
                    return (
                        <button
                            key={idx}
                            disabled={isPast}
                            onClick={() => onSelect(date)}
                            className={`h-8 w-full text-xs rounded-lg font-medium transition-colors
                                ${isSelected  ? 'bg-primary text-white font-black shadow-md shadow-primary/30' : ''}
                                ${!isSelected && isToday  ? 'border border-primary text-primary font-black' : ''}
                                ${!isSelected && !isToday && !isPast ? 'text-slate-700 hover:bg-primary/5 hover:text-primary' : ''}
                                ${isPast ? 'text-slate-200 cursor-not-allowed' : ''}
                            `}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
