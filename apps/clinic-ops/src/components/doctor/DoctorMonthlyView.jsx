/**
 * DoctorMonthlyView — monthly calendar grid with appointment dots.
 */

export default function DoctorMonthlyView({ monthlyDays, onDateSelect, onAppointmentOpen }) {
    return (
        <div className="h-full bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{day}</div>
                ))}
            </div>
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                {monthlyDays.map((dayData, i) => (
                    <div
                        key={i}
                        role={dayData.inMonth ? 'button' : undefined}
                        tabIndex={dayData.inMonth ? 0 : undefined}
                        onClick={() => dayData.inMonth && onDateSelect?.(new Date(dayData.date))}
                        onKeyDown={(event) => {
                            if (dayData.inMonth && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault();
                                onDateSelect?.(new Date(dayData.date));
                            }
                        }}
                        className={`border-r border-b border-slate-100 p-3 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${dayData.inMonth ? 'cursor-pointer' : ''} ${!dayData.inMonth ? 'bg-slate-50/30 text-slate-300' : ''} ${dayData.isToday ? 'bg-primary/5/20' : ''}`}
                    >
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
                                            <span
                                                key={j}
                                                role="button"
                                                tabIndex={0}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onAppointmentOpen?.(appt.id);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        onAppointmentOpen?.(appt.id);
                                                    }
                                                }}
                                                className={`block text-[10px] px-1.5 py-0.5 rounded font-bold border-l-2 truncate focus:outline-none focus:ring-2 focus:ring-primary/20 ${
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
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
