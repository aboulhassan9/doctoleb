import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';
import { referralService } from '../services/referrals';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { patientService } from '../services/patients';
import { doctorService } from '../services/doctors';

export default function DoctorReferralsPage() {
    const navigate = useNavigate();
    const [referTo, setReferTo] = useState('');
    const [patientStatus, setPatientStatus] = useState('normal');
    const [reason, setReason] = useState('');
    const [clinicalFindings, setClinicalFindings] = useState('');
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const { user } = useAuth();
    const { showToast } = useToast();
    const [doctorId, setDoctorId] = useState(null);
    const [doctorRecord, setDoctorRecord] = useState(null);

    // ── Signature pad ──────────────────────────────────────────
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();
        isDrawing.current = true;
        const ctx = canvas.getContext('2d');
        const { x, y } = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
    }, []);

    const draw = useCallback((e) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const { x, y } = getPos(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
    }, []);

    const stopDraw = useCallback(() => { isDrawing.current = false; }, []);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
        const fetchData = async () => {
            const [pRes, dRes] = await Promise.all([
                patientService.getAll(),
                doctorService.getByUserId(user?.id),
            ]);
            if (pRes.data) {
                setPatients(pRes.data);
                if (pRes.data.length > 0) setSelectedPatient(pRes.data[0]);
            }
            if (dRes.data) { setDoctorId(dRes.data.id); setDoctorRecord(dRes.data); }
        };
        if (user?.id) fetchData();
    }, [user?.id]);

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const refNumber = `REF-${Date.now().toString().slice(-6)}`;

    const handlePrint = () => {
        window.print();
    };

    const handleSend = async () => {
        if (!reason || !referTo) {
            showToast('Please provide a reason and recipient for the referral', 'error');
            return;
        }
        if (!doctorId) {
            showToast('Doctor profile not found. Please try again.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await referralService.create({
                from_doctor_id: doctorId,
                patient_id: selectedPatient?.id || null,
                to_doctor_name: referTo,
                priority: patientStatus,
                reason,
                clinical_findings: clinicalFindings,
                treatment_plan: treatmentPlan,
                ref_number: refNumber,
            });

            if (error) throw error;

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                navigate('/doctor-dashboard');
            }, 3000);
        } catch (error) {
            console.error('Failed to send referral:', error);
            showToast('Failed to send referral letter', 'error');
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
                            <input className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" placeholder="Search patients or reports..." type="text"/>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Status:</span>
                            <span className="h-2 w-2 rounded-full bg-success/100"></span>
                            <span className="text-xs font-medium text-success">Available</span>
                        </div>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <div className="h-8 w-px bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{user?.first_name} {user?.last_name}</p>
                                <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Doctor'}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">{user?.initials || '?'}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 pb-12">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <nav className="flex text-xs font-bold text-slate-400 uppercase tracking-widest gap-2 mb-2">
                                    <span onClick={() => navigate('/doctor-dashboard')} className="hover:text-primary cursor-pointer">Referrals</span>
                                    <span>/</span>
                                    <span className="text-primary">New Referral Letter</span>
                                </nav>
                                <h2 className="text-[30px] font-black tracking-tight text-slate-900 leading-none">Draft Referral Letter</h2>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handlePrint} className="bg-white border border-slate-200 px-6 py-2.5 rounded-xl font-bold text-sm text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
                                    <span className="material-symbols-outlined text-lg">print</span>
                                    Print Letter
                                </button>
                                <button onClick={handleSend} className="bg-primary text-white px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:text-primary transition-shadow shadow-lg shadow-primary/20 active:scale-95">
                                    <span className="material-symbols-outlined text-lg">send</span>
                                    Send via Secure Message
                                </button>
                            </div>
                        </div>

                        <div className="bg-white shadow-2xl shadow-slate-200 rounded-none border-t-[8px] border-primary p-12 relative">
                            <div className="flex justify-between border-b-2 border-slate-900 pb-8 mb-8">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Medical Referral Letter</h3>
                                    <p className="text-xs text-slate-500 italic">Confidential — For Medical Use Only</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Document Date</p>
                                    <p className="font-bold text-slate-900">{today}</p>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-4 mb-1">REF Number</p>
                                    <p className="font-bold text-slate-900">{refNumber}</p>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="grid grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Patient</label>
                                        <select
                                            value={selectedPatient?.id || ''}
                                            onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
                                            className="w-full border-b-2 border-slate-200 focus:border-primary bg-transparent py-2 font-bold text-slate-900 focus:ring-0 transition-colors px-0"
                                        >
                                            <option value="">— Select patient —</option>
                                            {patients.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.users?.first_name} {p.users?.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Referring To Doctor / Specialist</label>
                                        <div className="relative group">
                                            <input
                                                value={referTo}
                                                onChange={(e) => setReferTo(e.target.value)}
                                                className="w-full border-b-2 border-slate-200 focus:border-primary bg-transparent py-2 font-bold text-slate-900 focus:ring-0 transition-colors px-0"
                                                type="text"
                                            />
                                            <button className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined">person_search</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Current Patient Status</label>
                                        <div className="flex gap-4">
                                            <label className={`flex-1 flex items-center justify-center gap-2 border-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${patientStatus === 'urgent' ? 'border-primary/20 bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                <input 
                                                    checked={patientStatus === 'urgent'} 
                                                    onChange={() => setPatientStatus('urgent')} 
                                                    className="text-primary focus:ring-primary h-4 w-4" 
                                                    name="status" 
                                                    type="radio"
                                                />
                                                <span className={`text-xs font-bold ${patientStatus === 'urgent' ? 'text-primary' : 'text-slate-600'}`}>Urgent</span>
                                            </label>
                                            <label className={`flex-1 flex items-center justify-center gap-2 border-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${patientStatus === 'routine' ? 'border-primary/20 bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                <input 
                                                    checked={patientStatus === 'routine'} 
                                                    onChange={() => setPatientStatus('routine')} 
                                                    className="text-primary focus:ring-primary h-4 w-4" 
                                                    name="status" 
                                                    type="radio"
                                                />
                                                <span className={`text-xs font-bold ${patientStatus === 'routine' ? 'text-primary' : 'text-slate-600'}`}>Routine</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-12">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason for Referral</label>
                                        <textarea 
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full border-none focus:ring-0 bg-slate-50 rounded-xl p-4 text-sm font-medium text-slate-700 placeholder:italic leading-relaxed" 
                                            placeholder="Briefly state why the patient is being referred..." 
                                            rows="2"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Clinical Findings &amp; Observations</label>
                                        <textarea 
                                            value={clinicalFindings}
                                            onChange={(e) => setClinicalFindings(e.target.value)}
                                            className="w-full border-none focus:ring-0 bg-slate-50 rounded-xl p-4 text-sm font-medium text-slate-700 leading-relaxed" 
                                            placeholder="Patient presented with..." 
                                            rows="4"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-12">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pertinent Test Results</label>
                                            <div className="bg-slate-50 rounded-xl p-4 min-h-[160px] flex flex-col gap-2 items-center justify-center">
                                                <button className="w-full border-2 border-dashed border-slate-200 rounded-lg p-6 text-slate-400 flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined text-3xl">upload_file</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Attach Test Results</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Treatment Plan / Medications</label>
                                            <textarea 
                                                value={treatmentPlan}
                                                onChange={(e) => setTreatmentPlan(e.target.value)}
                                                className="w-full border-none focus:ring-0 bg-slate-50 rounded-xl p-4 text-sm font-medium text-slate-700 leading-relaxed" 
                                                placeholder="Current interventions and prescribed medications..." 
                                                rows="6"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-16 pt-12 border-t border-slate-100 grid grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Referring Doctor</p>
                                        <p className="text-lg font-black text-slate-900">{user?.first_name} {user?.last_name}</p>
                                        <p className="text-xs text-slate-500 capitalize">{doctorRecord?.specialization || user?.role || 'Physician'}</p>
                                    </div>
                                    <div className="space-y-2 col-span-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Digital Signature</p>
                                        <canvas
                                            ref={canvasRef}
                                            width={280}
                                            height={120}
                                            className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl cursor-crosshair touch-none"
                                            onMouseDown={startDraw}
                                            onMouseMove={draw}
                                            onMouseUp={stopDraw}
                                            onMouseLeave={stopDraw}
                                            onTouchStart={startDraw}
                                            onTouchMove={draw}
                                            onTouchEnd={stopDraw}
                                        />
                                        <div className="flex justify-between">
                                            <button onClick={clearSignature} className="text-[10px] font-bold uppercase text-slate-400 hover:text-critical transition-colors">Clear</button>
                                            <span className="text-[10px] font-bold uppercase text-success">Draw your signature above</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4 flex flex-col justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Date Signed</p>
                                            <p className="text-lg font-bold text-slate-900">{today}</p>
                                        </div>
                                        <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-3">
                                            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                            <p className="text-[10px] font-black text-primary uppercase leading-none">Document Confidential</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 text-center text-slate-400 border-t border-slate-100 pt-6">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Confidential Medical Correspondence • HIPAA Compliant Infrastructure</p>
                            </div>

                            <div className="absolute -top-4 -right-4 bg-primary text-white text-[10px] font-black uppercase px-4 py-2 rotate-1 shadow-lg">
                                Draft v1.2
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-green-600 text-4xl">check</span>
                        </div>
                        <p className="text-lg font-bold text-slate-900">Referral letter sent successfully!</p>
                        <button onClick={() => setShowSuccess(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}