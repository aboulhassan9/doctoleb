import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';
import { certificateService } from '../services/certificates';
import { patientService } from '../services/patients';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getUserDisplayName, getUserInitials } from '../lib/userDisplay';
import { useSignaturePad } from '../hooks/useSignaturePad';

export default function DoctorCertificatesPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [showNewCert, setShowNewCert] = useState(false);
    const [diagnosis, setDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [certificates, setCertificates] = useState([]);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const { canvasRef, startDraw, draw, stopDraw, clearSignature } = useSignaturePad();

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const [certRes, patRes] = await Promise.all([
                certificateService.getAll(),
                patientService.getAll(),
            ]);
            if (certRes.data) setCertificates(certRes.data);
            if (patRes.data) {
                setPatients(patRes.data);
                if (patRes.data.length > 0) setSelectedPatient(patRes.data[0]);
            }
            setLoading(false);
        };
        fetchAll();
    }, []);

    const filteredCertificates = certificates.filter(c => {
        const patientNameStr = c.patients?.users ? `${c.patients.users.first_name} ${c.patients.users.last_name}` : '';
        const matchesSearch = patientNameStr.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.id && c.id.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filter === 'all' || c.status === filter;
        return matchesSearch && matchesFilter;
    });

    const getDurationDays = () => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            return diff > 0 ? diff : 0;
        }
        return 0;
    };

    const patientName = selectedPatient
        ? `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim()
        : '';

    const handlePrint = () => {
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Medical Certificate - ${patientName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { font-size: 28px; margin: 0; }
                    .header .id { color: #0d6cf2; font-weight: bold; }
                    .patient { border-bottom: 1px solid #ccc; padding: 15px 0; font-size: 18px; font-style: italic; }
                    .content { line-height: 1.8; margin: 30px 0; }
                    .duration { background: #dbeafe; padding: 5px 10px; border-radius: 4px; font-weight: bold; color: #0d6cf2; }
                    .footer { border-top: 1px solid #ccc; padding-top: 20px; margin-top: 40px; display: flex; justify-content: space-between; }
                    .signature { border-top: 1px solid #000; width: 200px; padding-top: 5px; }
                    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 80px; opacity: 0.05; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>MEDICAL CERTIFICATE</h1>
                    <p style="font-size: 12px; color: #666;">Confidential Clinical Document</p>
                    <p>Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div class="patient">
                    <strong>${selectedPatient ? `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim() : '[Patient Name]'}</strong>
                </div>
                <div class="content">
                    <p>Was examined on this date and found to be suffering from <strong>${diagnosis || '[Diagnosis Input]'}</strong>.</p>
                    <p>For which the following treatment was administered: <em>${treatment || '[Treatment Details]'}</em>.</p>
                    <p>The patient is advised <strong>${recommendations || '[Recommendations]'}</strong> and is deemed unfit for work/duty for a period of <span class="duration">${getDurationDays()} days</span>, from ${startDate || 'Start Date'} to ${endDate || 'End Date'}.</p>
                </div>
                <div class="footer">
                    <div>
                        <div class="signature"></div>
                        <p><strong>${user?.first_name || ''} ${user?.last_name || ''}</strong></p>
                        <p style="font-size: 12px; text-transform: capitalize;">${user?.role || 'Physician'}</p>
                    </div>
                    <div>
                        <div style="width: 80px; height: 80px; border: 1px solid #ccc;"></div>
                        <p style="font-size: 10px; color: #666;">Scan to verify</p>
                    </div>
                </div>
                <div class="watermark">DOCTOLEB</div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);
    };

    const handleSaveCertificate = async () => {
        if (!diagnosis || !selectedPatient) {
            showToast('Please select a patient and provide a diagnosis', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await certificateService.create({
                doctor_id: user?.id,
                patient_id: selectedPatient.id,
                diagnosis,
                treatment,
                recommendations,
                start_date: startDate || null,
                end_date: endDate || null,
                status: 'Issued'
            });

            if (error) throw error;

            showToast('Certificate issued and saved successfully', 'success');
            setShowNewCert(false);
            // Refresh list
            const { data } = await certificateService.getAll();
            if (data) setCertificates(data);
        } catch (error) {
            console.error('Failed to save certificate:', error);
            showToast('Failed to issue certificate', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            const { error } = await certificateService.create({
                doctor_id: user?.id,
                patient_id: selectedPatient?.id || null,
                diagnosis,
                treatment,
                recommendations,
                start_date: startDate || null,
                end_date: endDate || null,
                status: 'Pending'
            });
            if (error) throw error;
            showToast('Draft saved successfully', 'success');
            setShowNewCert(false);
        } catch (error) {
            showToast('Failed to save draft', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-[#f5f7f8] text-[#0f172a] overflow-hidden font-['Inter']">
            <DoctorSidebar />

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="sticky top-0 z-20 h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search certificates..."
                                className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{user?.first_name} {user?.last_name}</p>
                                <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Doctor'}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{getUserInitials(user)}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 pb-12">
                    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col md:flex-row md:items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Certificates</h2>
                            <p className="text-slate-500 mt-2 text-base">Manage and generate medical certificates</p>
                        </div>
                        <div className="flex items-center gap-3 mt-4 md:mt-0">
                            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium">
                                <option value="all">All Certificates</option>
                                <option value="Issued">Issued</option>
                                <option value="Pending">Pending</option>
                            </select>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowNewCert(true)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl shadow-lg">
                                <span className="material-symbols-outlined text-lg">add</span>
                                New Certificate
                            </motion.button>
                        </div>
                    </motion.div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Certificate ID</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCertificates.map((cert, i) => (
                                    <motion.tr
                                        key={i}
                                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                                        className="group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold font-mono text-primary">{cert.id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-900">{cert.type}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-900">
                                                {cert.patients?.users ? `${cert.patients.users.first_name} ${cert.patients.users.last_name}` : 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600">
                                                {new Date(cert.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                cert.status === 'Issued' ? 'bg-green-100 text-green-700' : 'bg-warning/10 text-warning'
                                            }`}>
                                                {cert.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all">
                                                    View
                                                </motion.button>
                                                <button className="p-1.5 text-slate-400 hover:text-slate-600">
                                                    <span className="material-symbols-outlined text-lg">more_vert</span>
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {showNewCert && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-8 mx-8 flex flex-col">
                        <header className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-bold tracking-tight text-slate-900">Certificate Issuance</h3>
                                <p className="text-sm text-slate-500">Complete the fields below to generate the formal document.</p>
                            </div>
                            <button onClick={() => setShowNewCert(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </header>

                        <div className="flex-1 flex gap-8 p-8">
                            <div className="flex-1 space-y-6">
                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h4 className="text-lg font-bold tracking-tight text-slate-900">Certificate Details</h4>
                                            <p className="text-sm text-slate-500">Complete the fields below to generate the formal document.</p>
                                        </div>
                                        <button className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all">
                                            <span className="material-symbols-outlined">mic</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Patient</label>
                                            <select
                                                value={selectedPatient?.id || ''}
                                                onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
                                                className="w-full rounded-xl border border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4"
                                            >
                                                <option value="">— Select patient —</option>
                                                {patients.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.users?.first_name} {p.users?.last_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Diagnosis</label>
                                            <textarea 
                                                value={diagnosis}
                                                onChange={(e) => setDiagnosis(e.target.value)}
                                                className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" 
                                                placeholder="Enter primary medical diagnosis..." 
                                                rows="2"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Treatment Given</label>
                                            <textarea 
                                                value={treatment}
                                                onChange={(e) => setTreatment(e.target.value)}
                                                className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" 
                                                placeholder="Detail procedures, medications, or interventions administered..." 
                                                rows="3"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recommendations</label>
                                            <textarea 
                                                value={recommendations}
                                                onChange={(e) => setRecommendations(e.target.value)}
                                                className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" 
                                                placeholder="Rest requirements, follow-up dates, etc..." 
                                                rows="2"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration Start</label>
                                                <input 
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" 
                                                    type="date"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration End</label>
                                                <input 
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" 
                                                    type="date"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Digital Signature</label>
                                                <button onClick={clearSignature} className="text-[10px] font-bold uppercase text-slate-400 hover:text-critical transition-colors">Clear</button>
                                            </div>
                                            <canvas
                                                ref={canvasRef}
                                                width={600}
                                                height={120}
                                                className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-crosshair touch-none"
                                                onMouseDown={startDraw}
                                                onMouseMove={draw}
                                                onMouseUp={stopDraw}
                                                onMouseLeave={stopDraw}
                                                onTouchStart={startDraw}
                                                onTouchMove={draw}
                                                onTouchEnd={stopDraw}
                                            />
                                            <p className="text-[10px] text-slate-400">Draw your signature above</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4">
                                    <button disabled={isSaving} onClick={handleSaveDraft} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                                        {isSaving ? 'Saving...' : 'Save as Draft'}
                                    </button>
                                    <button disabled={isSaving} onClick={handleSaveCertificate} className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 hover:translate-y-[-1px] transition-all">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {isSaving ? 'Issuing...' : 'Issue Certificate'}
                                    </button>
                                </div>
                            </div>

                            <div className="w-[480px] hidden xl:block">
                                <div className="sticky top-24 bg-white border border-slate-200 shadow-2xl p-10 min-h-[640px] flex flex-col relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
                                    
                                    <div className="flex justify-between items-start mb-12">
                                        <div className="space-y-1">
                                            <h4 className="text-2xl font-black tracking-tight text-slate-900 leading-none">MEDICAL CERTIFICATE</h4>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Confidential Clinical Document</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-8">
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-slate-600">This is to certify that</p>
                                            <h5 className="text-lg font-bold border-b-2 border-slate-100 pb-1 italic">{selectedPatient ? `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim() : '[Patient Name]'}</h5>
                                        </div>

                                        <div className="space-y-4 text-sm leading-relaxed text-slate-800">
                                            <p>Was examined on this date and found to be suffering from <span className="font-bold">{diagnosis || '[Diagnosis Input]'}</span>.</p>
                                            <p>For which the following treatment was administered: <span className="italic text-slate-600">{treatment || '[Treatment Details]'}</span>.</p>
                                            <p>The patient is advised <span className="font-bold">{recommendations || '[Recommendations]'}</span> and is deemed unfit for work/duty for a period of <span className="bg-primary/5 px-2 py-0.5 rounded font-bold text-primary">[{getDurationDays()}] days</span>, from <span className="underline">{startDate || 'Start Date'}</span> to <span className="underline">{endDate || 'End Date'}</span>.</p>
                                        </div>
                                    </div>

                                    <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-2 items-end">
                                        <div className="space-y-4">
                                            <div className="h-12 w-32 border-b border-slate-200"></div>
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-slate-900">{user?.first_name} {user?.last_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize">{user?.role || 'Physician'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-block p-2 border border-slate-100 rounded-lg">
                                                <div className="w-12 h-12 bg-slate-200"></div>
                                            </div>
                                            <p className="text-[8px] text-slate-400 mt-2">Scan to verify document integrity</p>
                                        </div>
                                    </div>

                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-35deg]">
                                        <span className="text-8xl font-black select-none">DOCTOLEB</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <button className="flex-1 bg-slate-100 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-colors">Edit Header</button>
                                    <button className="flex-1 bg-slate-100 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-colors">Add Hospital Seal</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}