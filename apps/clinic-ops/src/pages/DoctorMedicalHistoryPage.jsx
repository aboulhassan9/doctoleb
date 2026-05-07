import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { logError } from '@/lib/logger';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '@/services/patients';
import { clinicalService } from '@/services/clinical';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { escapeHtml } from '@/lib/html';

export default function DoctorMedicalHistoryPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { displayName } = useBrand();
    const printableBrandName = escapeHtml(displayName);
    const [searchQuery, setSearchQuery] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');
    const [patient, setPatient] = useState(null);
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const [patientRes, encountersRes, diagnosesRes] = await Promise.all([
                    patientService.getById(id),
                    clinicalService.getEncountersByPatient(id, { pageSize: 100 }),
                    clinicalService.getDiagnoses(id, { pageSize: 100 })
                ]);

                if (patientRes.data) {
                    const p = patientRes.data;
                    const u = p.users || {};
                    const age = p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : '—';
                    setPatient({
                        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
                        initials: u.initials || ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase(),
                        id: p.id.split('-')[0],
                        age: age,
                        dob: p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—',
                        bloodType: p.blood_type || '—',
                        allergies: p.allergies || 'None recorded',
                    });
                }

                if (encountersRes.data) {
                    const diagnosesByEncounter = new Map(
                        (diagnosesRes.data || []).map((diagnosis) => [diagnosis.encounter_id, diagnosis])
                    );
                    const mappedVisits = encountersRes.data.map(c => {
                        const date = new Date(c.started_at || c.created_at);
                        const doc = c.doctors?.users || {};
                        const diagnosis = diagnosesByEncounter.get(c.id);
                        return {
                            date: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase(),
                            year: date.getFullYear().toString(),
                            reason: c.chief_complaint || c.appointments?.reason || 'Clinical encounter',
                            type: 'Standard',
                            reference: `#ENC-${c.id.split('-')[0]}`,
                            physician: `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || 'Unknown',
                            physicianInitials: `${doc.first_name?.[0] || ''}${doc.last_name?.[0] || ''}`.toUpperCase(),
                            department: c.doctors?.department || 'General Practice',
                            status: c.status === 'completed' ? 'Completed' : 'In Progress',
                            statusIcon: c.status === 'completed' ? 'check_circle' : 'pending',
                            statusColor: c.status === 'completed' ? 'text-success' : 'text-warning',
                            diagnosis: diagnosis?.diagnosis_text || diagnosis?.diseases?.name || c.summary || 'No diagnosis recorded yet.',
                        };
                    });
                    setVisits(mappedVisits);
                }
            } catch (err) {
                logError('Failed to fetch patient history:', err);
                showToast('Failed to load history', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
                <p className="text-slate-500 font-semibold">Patient record not found</p>
            </div>
        );
    }

    return (
        <DashboardLayout role="doctor">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="flex justify-between items-center h-16 px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(`/doctor-patient/${id}`)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">history</span>
                            <h2 className="text-xl font-bold text-slate-900">Patient History</h2>
                        </div>
                    </div>
                    <div className="flex-1 max-w-md mx-12 hidden lg:block">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20" 
                                placeholder="Search patient files..." 
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                            <span className="material-symbols-outlined">help</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}</p>
                                <p className="text-[10px] text-primary uppercase font-bold">{user?.role || 'Physician'}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{user?.first_name ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase() : '?'}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                        <div className="flex gap-6 items-start">
                            <div className="relative">
                                <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black shadow-sm ring-4 ring-white bg-primary/10 text-primary`}>
                                    {patient.initials}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-lg shadow-sm">
                                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-[30px] font-black tracking-tight text-slate-900 leading-none">{patient.name}</h1>
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider">Active Patient</span>
                                </div>
                                <p className="text-slate-500 font-medium flex items-center gap-2">
                                    <span className="text-slate-400">Patient ID:</span>
                                    <span className="text-slate-900 font-bold">{patient.id}</span>
                                    <span className="mx-2 text-slate-200">|</span>
                                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                    <span>Born: {patient.dob} ({patient.age}y)</span>
                                </p>
                                <div className="mt-4 flex gap-2">
                                    <span className="px-3 py-1 bg-slate-50 rounded-full text-xs font-bold text-slate-600 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span> Blood Type: {patient.bloodType}
                                    </span>
                                    <span className="px-3 py-1 bg-slate-50 rounded-full text-xs font-bold text-slate-600 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-warning/100"></span> {patient.allergies}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => {
                                const printContent = `
                                    <html>
                                    <head>
                                        <title>Patient Medical History - ${patient.name}</title>
                                        <style>
                                            * { margin: 0; padding: 0; box-sizing: border-box; }
                                            body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1e293b; }
                                            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0d6cf2; }
                                            .logo { display: flex; align-items: center; gap: 12px; }
                                            .logo-icon { width: 40px; height: 40px; background: #0d6cf2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
                                            .logo-text h1 { font-size: 18px; font-weight: 800; color: #0f172a; }
                                            .logo-text p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                                            .patient-info { display: flex; gap: 24px; margin-bottom: 30px; }
                                            .patient-avatar { width: 80px; height: 80px; background: #dbeafe; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #0d6cf2; }
                                            .patient-details h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
                                            .patient-details .id { font-size: 14px; color: #64748b; }
                                            .badges { display: flex; gap: 8px; margin-top: 12px; }
                                            .badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                                            .badge.red { background: #fee2e2; color: #dc2626; }
                                            .badge.blue { background: #dbeafe; color: #0d6cf2; }
                                            .section { margin-bottom: 24px; }
                                            .section-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
                                            .visit { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
                                            .visit-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
                                            .visit-date { font-size: 14px; font-weight: 700; }
                                            .visit-type { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
                                            .visit-type.urgent { background: #fee2e2; color: #dc2626; }
                                            .visit-type.annual { background: #dbeafe; color: #0d6cf2; }
                                            .visit-type.followup { background: #f1f5f9; color: #64748b; }
                                            .visit-reason { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
                                            .visit-doctor { font-size: 12px; color: #64748b; margin-bottom: 8px; }
                                            .visit-status { font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
                                            .status-complete { color: #059669; }
                                            .status-pending { color: #d97706; }
                                            .visit-diagnosis { font-size: 12px; color: #475569; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
                                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #64748b; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="header">
                                            <div class="logo">
                                                <div class="logo-icon">⚕</div>
                                                <div class="logo-text">
                                                    <h1>${printableBrandName}</h1>
                                                    <p>Medical Records</p>
                                                </div>
                                            </div>
                                            <div style="text-align: right;">
                                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Generated</div>
                                                <div style="font-size: 14px; font-weight: 600;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                            </div>
                                        </div>
                                        <div class="patient-info">
                                            <div class="patient-avatar">${patient.initials}</div>
                                            <div class="patient-details">
                                                <h2>${patient.name}</h2>
                                                <div class="id">Patient ID: ${patient.id}</div>
                                                <div class="badges">
                                                    <span class="badge red">Blood Type: ${patient.bloodType}</span>
                                                    <span class="badge blue">${patient.allergies}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="section">
                                            <div class="section-title">Clinical Visit History</div>
                                            ${visits.map(visit => `
                                                <div class="visit">
                                                    <div class="visit-header">
                                                        <span class="visit-date">${visit.date} ${visit.year}</span>
                                                        <span class="visit-type ${visit.type.toLowerCase().replace(' ', '')}">${visit.type}</span>
                                                    </div>
                                                    <div class="visit-reason">${visit.reason}</div>
                                                    <div class="visit-doctor">Attending: ${visit.physician} • ${visit.department}</div>
                                                    <div class="visit-status ${visit.status === 'Completed' ? 'status-complete' : 'status-pending'}">
                                                        <span>${visit.status === 'Completed' ? '✓' : '⚠'}</span> ${visit.status}
                                                    </div>
                                                    <div class="visit-diagnosis">${visit.diagnosis}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="footer">
                                            <p>This is a computer-generated medical record. ${printableBrandName} • Generated on ${new Date().toLocaleString()}</p>
                                        </div>
                                    </body>
                                    </html>
                                `;
                                const printWindow = window.open('', '_blank');
                                printWindow.document.write(printContent);
                                printWindow.document.close();
                                printWindow.print();
                            }} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all shadow-sm">
                                <span className="material-symbols-outlined text-[18px]">print</span>
                                Print View
                            </button>
                            <button onClick={() => {
                                const printContent = `
                                    <html>
                                    <head>
                                        <title>Patient Medical History - ${patient.name}</title>
                                        <style>
                                            * { margin: 0; padding: 0; box-sizing: border-box; }
                                            body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1e293b; }
                                            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0d6cf2; }
                                            .logo { display: flex; align-items: center; gap: 12px; }
                                            .logo-icon { width: 40px; height: 40px; background: #0d6cf2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
                                            .logo-text h1 { font-size: 18px; font-weight: 800; color: #0f172a; }
                                            .logo-text p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                                            .patient-info { display: flex; gap: 24px; margin-bottom: 30px; }
                                            .patient-avatar { width: 80px; height: 80px; background: #dbeafe; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #0d6cf2; }
                                            .patient-details h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
                                            .patient-details .id { font-size: 14px; color: #64748b; }
                                            .badges { display: flex; gap: 8px; margin-top: 12px; }
                                            .badge { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                                            .badge.red { background: #fee2e2; color: #dc2626; }
                                            .badge.blue { background: #dbeafe; color: #0d6cf2; }
                                            .section { margin-bottom: 24px; }
                                            .section-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
                                            .visit { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
                                            .visit-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
                                            .visit-date { font-size: 14px; font-weight: 700; }
                                            .visit-type { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
                                            .visit-type.urgent { background: #fee2e2; color: #dc2626; }
                                            .visit-type.annual { background: #dbeafe; color: #0d6cf2; }
                                            .visit-type.followup { background: #f1f5f9; color: #64748b; }
                                            .visit-reason { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
                                            .visit-doctor { font-size: 12px; color: #64748b; margin-bottom: 8px; }
                                            .visit-status { font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
                                            .status-complete { color: #059669; }
                                            .status-pending { color: #d97706; }
                                            .visit-diagnosis { font-size: 12px; color: #475569; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
                                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #64748b; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="header">
                                            <div class="logo">
                                                <div class="logo-icon">⚕</div>
                                                <div class="logo-text">
                                                    <h1>${printableBrandName}</h1>
                                                    <p>Medical Records</p>
                                                </div>
                                            </div>
                                            <div style="text-align: right;">
                                                <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Generated</div>
                                                <div style="font-size: 14px; font-weight: 600;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                            </div>
                                        </div>
                                        <div class="patient-info">
                                            <div class="patient-avatar">${patient.initials}</div>
                                            <div class="patient-details">
                                                <h2>${patient.name}</h2>
                                                <div class="id">Patient ID: ${patient.id}</div>
                                                <div class="badges">
                                                    <span class="badge red">Blood Type: ${patient.bloodType}</span>
                                                    <span class="badge blue">${patient.allergies}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="section">
                                            <div class="section-title">Clinical Visit History</div>
                                            ${visits.map(visit => `
                                                <div class="visit">
                                                    <div class="visit-header">
                                                        <span class="visit-date">${visit.date} ${visit.year}</span>
                                                        <span class="visit-type ${visit.type.toLowerCase().replace(' ', '')}">${visit.type}</span>
                                                    </div>
                                                    <div class="visit-reason">${visit.reason}</div>
                                                    <div class="visit-doctor">Attending: ${visit.physician} • ${visit.department}</div>
                                                    <div class="visit-status ${visit.status === 'Completed' ? 'status-complete' : 'status-pending'}">
                                                        <span>${visit.status === 'Completed' ? '✓' : '⚠'}</span> ${visit.status}
                                                    </div>
                                                    <div class="visit-diagnosis">${visit.diagnosis}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="footer">
                                            <p>This is a computer-generated medical record. ${printableBrandName} • Generated on ${new Date().toLocaleString()}</p>
                                        </div>
                                    </body>
                                    </html>
                                `;
                                const blob = new Blob([printContent], { type: 'text/html' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Patient_History_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:text-primary font-bold text-sm rounded-xl transition-all shadow-lg">
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Download All Records
                            </button>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Clinical Timeline</h3>
                            <div className="flex gap-2">
                                <select 
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value)}
                                    className="text-xs font-bold bg-slate-50 rounded-lg py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="all">All Visits</option>
                                    <option value="6months">Last 6 Months</option>
                                    <option value="1year">Past Year</option>
                                </select>
                                <button className="p-1.5 bg-slate-50 rounded-lg text-slate-500 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined">filter_list</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {visits.filter(v => 
                                searchQuery === '' || 
                                v.reason.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                v.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                v.physician.toLowerCase().includes(searchQuery.toLowerCase())
                            ).map((visit, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="grid grid-cols-12 gap-0 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group border border-slate-100"
                                >
                                    <div className="col-span-12 md:col-span-2 p-6 flex flex-col justify-center items-center border-b md:border-b-0 md:border-r border-slate-50 bg-slate-50/30">
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Date of visit</span>
                                        <span className="text-xl font-black text-slate-900">{visit.date}</span>
                                        <span className="text-xs font-bold text-primary">{visit.year}</span>
                                    </div>
                                    <div className="col-span-12 md:col-span-4 p-6 flex flex-col justify-center">
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Reason for Visit</span>
                                        <h4 className="font-bold text-slate-900 text-lg mb-1">{visit.reason}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                                                visit.type === 'Urgent' ? 'bg-critical/10 text-critical' : 
                                                visit.type === 'Annual' ? 'bg-primary/5 text-primary' : 
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {visit.type}
                                            </span>
                                            {visit.reference && (
                                                <span className="text-xs text-slate-500 italic">{visit.reference}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-3 p-6 flex flex-col justify-center">
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Attending Physician</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {visit.physicianInitials}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 leading-none">{visit.physician}</p>
                                                <p className="text-[11px] text-slate-500 font-medium">{visit.department}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-3 p-6 flex flex-col justify-center bg-slate-50/20">
                                        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Status</span>
                                        <div className={`flex items-center gap-1.5 ${visit.statusColor}`}>
                                            <span className="material-symbols-outlined text-[14px]">{visit.statusIcon}</span>
                                            <span className="text-[11px] font-bold uppercase tracking-wide">{visit.status}</span>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button className="flex-1 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 font-bold text-[11px] py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">visibility</span> Report
                                            </button>
                                            <button className="flex-1 bg-white border border-slate-200 hover:border-blue-300 text-slate-700 font-bold text-[11px] py-2 rounded-lg transition-all flex items-center justify-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">medical_services</span> Presc.
                                            </button>
                                        </div>
                                    </div>
                                    <div className="col-span-12 p-6 pt-0 mt-2">
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Diagnosis Summary</span>
                                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                                {visit.diagnosis}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="flex justify-center pt-4">
                            <button className="text-sm font-bold text-primary hover:text-blue-800 flex items-center gap-2">
                                Load Older Records
                                <span className="material-symbols-outlined">expand_more</span>
                            </button>
                        </div>
                    </section>

                <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl" style={{ fontWeight: 700 }}>add</span>
                </button>
            </div>
            </div>
        </DashboardLayout>
    );
}
