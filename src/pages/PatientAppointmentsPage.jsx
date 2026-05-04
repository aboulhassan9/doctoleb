import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { appointmentService } from '../services/appointments';
import { slotService } from '../services/slots';
import { clinicService } from '../services/clinics';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STEPS, normalizeAppointments } from '../lib/appointments';
import { formatClinicDate, formatClinicTime, isFutureClinicDateTime, normalizeTimeValue } from '../lib/time';
import { getHomeRouteForRole } from '../lib/routes';

export default function PatientAppointmentsPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [appointments, setAppointments] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [cancelConfirmId, setCancelConfirmId] = useState(null);

    useEffect(() => {
        fetchAppointments();
    }, [user?.id]);

    useEffect(() => {
        if (selectedDate) {
            setSelectedSlot(null);
            fetchAvailableSlots();
        }
    }, [selectedDate]);

    async function fetchAppointments() {
        try {
            const { data, error } = await appointmentService.getByPatientId(user?.patient_id);
            if (!error && data) {
                setAppointments(normalizeAppointments(data || []));
            }
        } catch (err) {
            showToast('Failed to load appointments', 'error');
        }
    }

    async function fetchAvailableSlots() {
        try {
            const { data: doctor, error } = await clinicService.getMainDoctor();
            if (!error && doctor?.id) {
                const { data: slots } = await slotService.getAvailableSlots(doctor.id, selectedDate);
                setAvailableSlots(slots || []);
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
        }
    }

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        if (!selectedDate || !selectedSlot?.id || !reason.trim()) {
            showToast('Please fill all fields', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const { data, error } = await appointmentService.bookFromSlot({
                slotId: selectedSlot.id,
                patientId: user?.patient_id,
                bookedBy: user?.id,
                reason: reason.trim(),
                durationMinutes: 30,
                status: 'scheduled',
            });
            if (!error && data) {
                showToast('Appointment booked successfully!', 'success');
                await fetchAppointments();
                setSelectedDate('');
                setSelectedSlot(null);
                setReason('');
                setActiveTab('upcoming');
            } else {
                showToast(error || 'Failed to book appointment', 'error');
            }
        } catch (err) {
            console.error('Error booking appointment:', err);
            showToast('An error occurred', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelAppointment = async (appointmentId) => {
        try {
            setSubmitting(true);
            const { error } = await appointmentService.cancel(appointmentId);
            if (!error) {
                await fetchAppointments();
                showToast('Appointment cancelled', 'success');
            } else {
                showToast('Failed to cancel appointment', 'error');
            }
        } catch (err) {
            console.error('Error cancelling appointment:', err);
        } finally {
            setSubmitting(false);
            setCancelConfirmId(null);
        }
    };

    function StatusTimeline({ status }) {
        const current = APPOINTMENT_STATUS_STEPS.indexOf(status);
        return (
            <div className="flex items-center gap-1 mt-3">
                {APPOINTMENT_STATUS_STEPS.map((step, i) => {
                    const done = i <= current;
                    return (
                        <div key={step} className="flex items-center gap-1 flex-1 last:flex-none">
                            <div className={`flex flex-col items-center gap-0.5 flex-1`}>
                                <div className={`w-2.5 h-2.5 rounded-full border-2 ${done ? 'bg-primary border-primary' : 'bg-white border-slate-300'}`} />
                                <span className={`text-[10px] font-medium whitespace-nowrap ${done ? 'text-primary' : 'text-slate-400'}`}>{APPOINTMENT_STATUS_LABELS[step]}</span>
                            </div>
                            {i < APPOINTMENT_STATUS_STEPS.length - 1 && (
                                <div className={`h-0.5 flex-1 mb-3 ${done && i < current ? 'bg-primary' : 'bg-slate-200'}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    const upcomingAppointments = appointments.filter(a => a.status !== 'cancelled' && isFutureClinicDateTime(a.scheduled_at));
    const pastAppointments = appointments.filter(a => a.status === 'cancelled' || !isFutureClinicDateTime(a.scheduled_at));

    const getMinDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    return (
        <div className="min-h-screen bg-background-light">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">Appointments</h1>
                            <p className="text-xs text-slate-500">Manage your appointments</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(getHomeRouteForRole(user?.role))}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            Back to Dashboard
                        </button>
                        <button
                            onClick={async () => {
                                await logout();
                                navigate('/login');
                            }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('upcoming')}
                        className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
                            activeTab === 'upcoming'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Upcoming ({upcomingAppointments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('past')}
                        className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
                            activeTab === 'past'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Past ({pastAppointments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('book')}
                        className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
                            activeTab === 'book'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Book New
                    </button>
                </div>

                {/* Upcoming Appointments */}
                {activeTab === 'upcoming' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6"
                    >
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Your Upcoming Appointments</h2>
                        {upcomingAppointments.length > 0 ? (
                            <div className="space-y-4">
                                {upcomingAppointments.map(apt => (
                                    <div key={apt.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-primary transition-all">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-slate-900 mb-1">{apt.reason}</p>
                                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-base text-slate-400">calendar_month</span>
                                                    {formatClinicDate(apt.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric' })} &nbsp;·&nbsp; {formatClinicTime(apt.scheduled_at)}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">timer</span>
                                                    {apt.duration_minutes} min
                                                </p>
                                                <StatusTimeline status={apt.status || 'scheduled'} />
                                            </div>
                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                {cancelConfirmId === apt.id ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className="text-xs text-slate-600 font-medium">Cancel this appointment?</p>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setCancelConfirmId(null)}
                                                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                                            >
                                                                Keep
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelAppointment(apt.id)}
                                                                disabled={submitting}
                                                                className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all disabled:opacity-50"
                                                            >
                                                                Yes, Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setCancelConfirmId(apt.id)}
                                                        className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-3xl text-primary">event_available</span>
                                </div>
                                <p className="text-slate-700 font-semibold mb-1">No upcoming appointments</p>
                                <p className="text-sm text-slate-400 mb-6">Book one below to get started.</p>
                                <button
                                    onClick={() => setActiveTab('book')}
                                    className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all"
                                >
                                    Book an Appointment
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Past Appointments */}
                {activeTab === 'past' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6"
                    >
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Past Appointments</h2>
                        {pastAppointments.length > 0 ? (
                            <div className="space-y-4">
                                {pastAppointments.map(apt => {
                                    const statusColor = apt.status === 'completed' ? 'text-success bg-success/10' : apt.status === 'cancelled' ? 'text-red-500 bg-red-50' : 'text-slate-600 bg-slate-100';
                                    return (
                                        <div key={apt.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-900 mb-1">{apt.reason}</p>
                                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-base text-slate-400">calendar_month</span>
                                                        {formatClinicDate(apt.scheduled_at, { weekday: 'short', month: 'short', day: 'numeric' })} &nbsp;·&nbsp; {formatClinicTime(apt.scheduled_at)}
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${statusColor}`}>
                                                    {apt.status || 'completed'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">history</span>
                                <p className="text-slate-500">No past appointments</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Book New Appointment */}
                {activeTab === 'book' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl"
                    >
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Book an Appointment</h2>
                        <form onSubmit={handleBookAppointment} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Appointment Date
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={getMinDate()}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>

                            {selectedDate && availableSlots.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Available Time Slots
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {availableSlots.map((slot) => (
                                            <button
                                                key={slot.id}
                                                type="button"
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                                                    selectedSlot?.id === slot.id
                                                        ? 'bg-primary text-white'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {normalizeTimeValue(slot.start_time)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Reason for Visit
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Describe your symptoms or reason for the appointment..."
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                    rows="4"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !selectedDate || !selectedSlot?.id || !reason}
                                className="w-full py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                                        Booking...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-base">calendar_add_on</span>
                                        Book Appointment
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
