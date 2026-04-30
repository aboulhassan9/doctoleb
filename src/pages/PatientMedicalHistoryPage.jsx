import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { reportService } from '../services/reports';

export default function PatientMedicalHistoryPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        fetchMedicalHistory();
    }, [user?.patient_id]);

    const fetchMedicalHistory = async () => {
        try {
            setLoading(true);
            const { data, error } = await reportService.getByPatientId(user?.patient_id);
            if (!error && data) {
                setReports(data || []);
            }
        } catch (err) {
            console.error('Error fetching medical history:', err);
            showToast('Failed to load medical history', 'error');
        } finally {
            setLoading(false);
        }
    };

    const prescriptions = reports.filter(r => r.report_type === 'Prescription');
    const labResults = reports.filter(r => r.report_type === 'Lab Request' || r.report_type === 'Lab Result');
    const certificates = reports.filter(r => r.report_type === 'Certificate');
    const referrals = reports.filter(r => r.report_type === 'Referral');

    const getTabCount = () => {
        switch (activeTab) {
            case 'prescriptions': return prescriptions.length;
            case 'labs': return labResults.length;
            case 'certificates': return certificates.length;
            case 'referrals': return referrals.length;
            default: return reports.length;
        }
    };

    const getDisplayReports = () => {
        switch (activeTab) {
            case 'prescriptions': return prescriptions;
            case 'labs': return labResults;
            case 'certificates': return certificates;
            case 'referrals': return referrals;
            default: return reports;
        }
    };

    const displayReports = getDisplayReports();
    const noDataMessage = `No ${activeTab === 'all' ? 'medical records' : activeTab.toLowerCase()} found`;

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
                            <h1 className="text-lg font-bold text-slate-900">Medical History</h1>
                            <p className="text-xs text-slate-500">View your medical records</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
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
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Loading medical history...</p>
                    </div>
                ) : (
                    <>
                        {/* Tab Navigation */}
                        <div className="flex gap-2 mb-8 border-b border-slate-200 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === 'all'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All Records ({reports.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('prescriptions')}
                                className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === 'prescriptions'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                💊 Prescriptions ({prescriptions.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('labs')}
                                className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === 'labs'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                🧪 Lab Results ({labResults.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('certificates')}
                                className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === 'certificates'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                📜 Certificates ({certificates.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('referrals')}
                                className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                                    activeTab === 'referrals'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                🏥 Referrals ({referrals.length})
                            </button>
                        </div>

                        {/* Records List */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl border border-slate-200 p-6"
                        >
                            {displayReports.length > 0 ? (
                                <div className="space-y-4">
                                    {displayReports.map(report => (
                                        <motion.div
                                            key={report.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-5 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 hover:border-primary hover:shadow-lg transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xl">
                                                        {report.report_type === 'Prescription' && '💊'}
                                                        {report.report_type?.includes('Lab') && '🧪'}
                                                        {report.report_type === 'Certificate' && '📜'}
                                                        {report.report_type === 'Referral' && '🏥'}
                                                        {!['Prescription', 'Lab Request', 'Lab Result', 'Certificate', 'Referral'].includes(report.report_type) && '📋'}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="font-bold text-slate-900 text-lg">{report.title}</h3>
                                                            <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full">
                                                                {report.report_type}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 mb-2">{report.content}</p>
                                                        <p className="text-xs text-slate-500">
                                                            📅 {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => window.open(`/reports/${report.id}/download`, '_blank')}
                                                        className="px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                    >
                                                        📥 Download
                                                    </button>
                                                </div>
                                            </div>

                                            {report.metadata && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {Object.entries(report.metadata).map(([key, value]) => (
                                                            <div key={key} className="text-sm">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{key}</p>
                                                                <p className="font-semibold text-slate-900">{value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="text-5xl mb-4">📭</div>
                                    <p className="text-slate-500 font-medium mb-2">{noDataMessage}</p>
                                    <p className="text-sm text-slate-400">
                                        Your {activeTab === 'all' ? 'medical records' : activeTab.toLowerCase()} will appear here
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Summary Stats */}
                        {reports.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4"
                            >
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-lg transition-all">
                                    <p className="text-3xl font-black text-primary mb-2">{prescriptions.length}</p>
                                    <p className="text-sm font-semibold text-slate-600">Prescriptions</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-lg transition-all">
                                    <p className="text-3xl font-black text-success mb-2">{labResults.length}</p>
                                    <p className="text-sm font-semibold text-slate-600">Lab Results</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-lg transition-all">
                                    <p className="text-3xl font-black text-warning mb-2">{certificates.length}</p>
                                    <p className="text-sm font-semibold text-slate-600">Certificates</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center hover:shadow-lg transition-all">
                                    <p className="text-3xl font-black text-secondary mb-2">{referrals.length}</p>
                                    <p className="text-sm font-semibold text-slate-600">Referrals</p>
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
