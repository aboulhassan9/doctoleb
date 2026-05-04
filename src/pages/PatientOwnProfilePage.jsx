import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { patientService } from '../services/patients';
import { getHomeRouteForRole } from '../lib/routes';

export default function PatientOwnProfilePage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [patient, setPatient] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        date_of_birth: '',
        sex: '',
        blood_type: '',
        allergies: '',
        insurance_id: '',
        emergency_contact: '',
        emergency_phone: '',
        medical_history: '',
    });

    useEffect(() => {
        fetchPatientProfile();
    }, [user?.id]);

    async function fetchPatientProfile() {
        try {
            setLoading(true);
            const { data, error } = await patientService.getByUserId(user?.id);
            if (!error && data) {
                setPatient(data);
                setFormData({
                    first_name: user?.first_name || '',
                    last_name: user?.last_name || '',
                    phone: user?.phone || '',
                    date_of_birth: data.date_of_birth || '',
                    sex: data.sex || '',
                    blood_type: data.blood_type || '',
                    allergies: data.allergies || '',
                    insurance_id: data.insurance_id || '',
                    emergency_contact: data.emergency_contact || '',
                    emergency_phone: data.emergency_phone || '',
                    medical_history: data.medical_history || '',
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
            showToast('Failed to load profile', 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        
        const sanitizedFirst = formData.first_name?.trim();
        const sanitizedLast = formData.last_name?.trim();
        const sanitizedPhone = formData.phone?.trim();

        if (!sanitizedFirst || !sanitizedLast) {
            showToast('First and Last Name are required', 'error');
            return;
        }

        if (sanitizedPhone && !/^\+?[\d\s-]{8,20}$/.test(sanitizedPhone)) {
            showToast('Please enter a valid phone number', 'error');
            return;
        }

        if (formData.emergency_phone && !/^\+?[\d\s-]{8,20}$/.test(formData.emergency_phone)) {
            showToast('Please enter a valid emergency contact phone', 'error');
            return;
        }

        try {
            setSubmitting(true);
            const { error } = await patientService.updateOwnProfile({
                userId: user?.id,
                patientId: patient?.id,
                profile: {
                    first_name: sanitizedFirst,
                    last_name: sanitizedLast,
                    phone: sanitizedPhone || null,
                    date_of_birth: formData.date_of_birth || null,
                    sex: formData.sex || null,
                    blood_type: formData.blood_type || null,
                    allergies: formData.allergies || null,
                    insurance_id: formData.insurance_id || null,
                    emergency_contact: formData.emergency_contact || null,
                    emergency_phone: formData.emergency_phone || null,
                    medical_history: formData.medical_history || null,
                },
            });

            if (!error) {
                showToast('Profile updated successfully', 'success');
                setIsEditing(false);
                fetchPatientProfile();
            } else {
                console.error(error);
                showToast(error || 'Failed to update profile', 'error');
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            showToast('An error occurred', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-light flex items-center justify-center">
                <p className="text-slate-500">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black">
                            {user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900">My Profile</h1>
                            <p className="text-xs text-slate-500">View and manage your information</p>
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

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Profile Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 p-8 mb-8"
                >
                    <div className="flex items-end gap-6 mb-6">
                        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-4xl font-black">
                            {user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-3xl font-black text-slate-900 mb-1">
                                {formData.first_name} {formData.last_name}
                            </h2>
                            <p className="text-sm text-slate-600 mb-4">Patient ID: {patient?.id}</p>
                            <div className="flex gap-2">
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-all"
                                    >
                                        Edit Profile
                                    </button>
                                )}
                                {isEditing && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                fetchPatientProfile();
                                            }}
                                            className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={submitting}
                                            className="px-4 py-2 bg-success text-white text-sm font-bold rounded-lg hover:bg-success/90 disabled:opacity-50 transition-all"
                                        >
                                            {submitting ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Personal Information */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6 mb-6"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span>👤</span> Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                            <select
                                name="sex"
                                value={formData.sex}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Blood Type</label>
                            <select
                                name="blood_type"
                                value={formData.blood_type}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                            >
                                <option value="">Select Blood Type</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Medical Information */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6 mb-6"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span>🏥</span> Medical Information
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
                            <textarea
                                name="allergies"
                                value={formData.allergies}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                placeholder="List any known allergies..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                rows="3"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Medical History</label>
                            <textarea
                                name="medical_history"
                                value={formData.medical_history}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                placeholder="Describe any past medical conditions, surgeries, etc..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                rows="4"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Insurance ID</label>
                            <input
                                type="text"
                                name="insurance_id"
                                value={formData.insurance_id}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                placeholder="Your insurance policy number"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Emergency Contact */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl border border-slate-200 p-6"
                >
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <span>🆘</span> Emergency Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Name</label>
                            <input
                                type="text"
                                name="emergency_contact"
                                value={formData.emergency_contact}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                placeholder="Full name"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Phone</label>
                            <input
                                type="tel"
                                name="emergency_phone"
                                value={formData.emergency_phone}
                                onChange={handleInputChange}
                                disabled={!isEditing}
                                placeholder="Phone number"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
