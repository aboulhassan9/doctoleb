import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { appointmentService } from '../services/appointments';
import { notificationService } from '../services/notifications';
import { patientService } from '../services/patients';

export default function PatientDashboardPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [upcomingAppointments, setUpcomingAppointments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch patient data
                const { data: patientData } = await patientService.getByUserId(user?.id);
                if (patientData) setPatient(patientData);

                // Fetch upcoming appointments
                const { data: appointments } = await appointmentService.getByPatientId(patientData?.id);
                if (appointments) {
                    const upcoming = appointments.filter(a => new Date(a.scheduled_at) > new Date());
                    setUpcomingAppointments(upcoming.slice(0, 3));
                }

                // Fetch notifications
                const { data: notifs } = await notificationService.getUnread(user?.id);
                if (notifs) setNotifications(notifs.slice(0, 5));
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.id) fetchData();
    }, [user?.id]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background-light">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black">
                            {user?.initials}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">Patient Portal</h1>
                            <p className="text-xs text-slate-500">Welcome, {user?.first_name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Loading...</p>
                    </div>
                ) : (
                    <>
                        {/* Quick Actions */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
                        >
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => navigate('/patient-appointments')}
                                className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg transition-all text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined">calendar_month</span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">Book Appointment</h3>
                                <p className="text-xs text-slate-500">Schedule with doctor</p>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => navigate('/patient-profile')}
                                className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg transition-all text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">My Profile</h3>
                                <p className="text-xs text-slate-500">View & edit info</p>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => navigate('/patient-history')}
                                className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg transition-all text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center mb-3 group-hover:bg-success group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined">history</span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">Medical History</h3>
                                <p className="text-xs text-slate-500">Records & reports</p>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                className="p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary hover:shadow-lg transition-all text-left group relative"
                            >
                                <div className="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-3 group-hover:bg-warning group-hover:text-white transition-all">
                                    <span className="material-symbols-outlined">notifications</span>
                                </div>
                                <h3 className="font-bold text-slate-900 mb-1">Notifications</h3>
                                <p className="text-xs text-slate-500">{notifications.length} unread</p>
                                {notifications.length > 0 && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-critical rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {notifications.length}
                                    </div>
                                )}
                            </motion.button>
                        </motion.div>

                        {/* Upcoming Appointments */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-2xl border border-slate-200 p-6 mb-8"
                        >
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Upcoming Appointments</h2>
                            {upcomingAppointments.length > 0 ? (
                                <div className="space-y-3">
                                    {upcomingAppointments.map(apt => (
                                        <div key={apt.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-primary transition-all">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{apt.reason}</p>
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        📅 {new Date(apt.scheduled_at).toLocaleDateString()} at {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className="px-3 py-1 text-xs font-semibold text-success bg-success/10 rounded-full">
                                                        {apt.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 mb-4">No upcoming appointments</p>
                                    <button
                                        onClick={() => navigate('/patient-appointments')}
                                        className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all"
                                    >
                                        Book First Appointment
                                    </button>
                                </div>
                            )}
                        </motion.div>

                        {/* Patient Info Summary */}
                        {patient && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-2xl border border-slate-200 p-6"
                            >
                                <h2 className="text-xl font-bold text-slate-900 mb-4">Medical Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold uppercase">Blood Type</p>
                                        <p className="text-lg font-bold text-slate-900">{patient.blood_type || 'Not set'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold uppercase">Gender</p>
                                        <p className="text-lg font-bold text-slate-900">{patient.sex || 'Not set'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold uppercase">Allergies</p>
                                        <p className="text-lg font-bold text-slate-900">{patient.allergies || 'None'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-semibold uppercase">Insurance</p>
                                        <p className="text-lg font-bold text-slate-900">{patient.insurance_id || 'Not set'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
