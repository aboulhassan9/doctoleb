/**
 * CertificateFormModal — Full-screen modal for creating and previewing medical certificates.
 *
 * Contains: patient selector, form fields, digital signature pad, live preview panel.
 * Replaces ~200 lines of inline modal markup from DoctorCertificatesPage.
 */
import { useState, useEffect } from 'react';
import { logError } from '@/lib/logger';
import { documentService } from '@/services/documents';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useBrand } from '@/contexts/BrandContext';
import { getUserDisplayName } from '@/lib/userDisplay';
import { useSignaturePad } from '@/hooks/useSignaturePad';
import { openPrintableHtml } from '@/lib/html';
import { buildCertificatePrintHtml } from './certificatePrintTemplate';

export default function CertificateFormModal({ isOpen, onClose, patients, doctorId, onSaved }) {
    const [diagnosis, setDiagnosis] = useState('');
    const [treatment, setTreatment] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const { user } = useAuth();
    const { showToast } = useToast();
    const { displayName } = useBrand();
    const { canvasRef, startDraw, draw, stopDraw, clearSignature } = useSignaturePad();

    useEffect(() => {
        if (isOpen && patients?.length > 0 && !selectedPatient) {
            setSelectedPatient(patients[0]);
        }
    }, [isOpen, patients, selectedPatient]);

    if (!isOpen) return null;

    const patientName = selectedPatient
        ? `${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim()
        : '';

    const getDurationDays = () => {
        if (startDate && endDate) {
            const diff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
            return diff > 0 ? diff : 0;
        }
        return 0;
    };

    const doctorName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
    const doctorRole = user?.role || 'Physician';

    const handlePrint = () => {
        const html = buildCertificatePrintHtml({
            patientName,
            diagnosis,
            treatment,
            recommendations,
            startDate,
            endDate,
            durationDays: getDurationDays(),
            doctorName,
            doctorRole,
            brandName: displayName,
        });

        if (!openPrintableHtml(html, { printDelayMs: 250 })) {
            showToast('Unable to open print preview. Please allow popups for this site.', 'error');
        }
    };

    const saveCertificate = async (isDraft = false) => {
        if (!isDraft && (!diagnosis || !selectedPatient || !doctorId)) {
            showToast('Please select a patient, provide a diagnosis, and make sure your doctor profile is loaded', 'error');
            return;
        }
        if (isDraft && (!doctorId || !selectedPatient)) {
            showToast('Please select a patient and make sure your doctor profile is loaded.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const titleDiagnosis = diagnosis.length > 120 ? `${diagnosis.slice(0, 117)}...` : diagnosis;
            const title = isDraft
                ? `Draft Medical Certificate${patientName ? ` - ${patientName}` : ''}`
                : `Medical Certificate - ${patientName || selectedPatient.id.slice(0, 8)} - ${titleDiagnosis}`.slice(0, 240);

            const { error } = await documentService.createCertificate({
                patient_id: selectedPatient.id,
                doctor_id: doctorId,
                title,
                issuer: getUserDisplayName(user, 'Doctor'),
                start_date: startDate || (isDraft ? null : new Date().toISOString().slice(0, 10)),
                end_date: endDate || null,
                diagnosis,
                treatment,
                recommendations,
                created_by: user.id,
            });

            if (error) throw error;

            showToast(isDraft ? 'Draft saved successfully' : 'Certificate issued and saved successfully', 'success');
            onClose();
            onSaved?.();
        } catch (error) {
            logError('Failed to save certificate:', error);
            showToast(isDraft ? 'Failed to save draft' : 'Failed to issue certificate', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-8 mx-8 flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-slate-900">Certificate Issuance</h3>
                        <p className="text-sm text-slate-500">Complete the fields below to generate the formal document.</p>
                    </div>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close certificate form">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                {/* Body */}
                <div className="flex-1 flex gap-8 p-8">
                    {/* Left: Form */}
                    <div className="flex-1 space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h4 className="text-lg font-bold tracking-tight text-slate-900">Certificate Details</h4>
                                    <p className="text-sm text-slate-500">Complete the fields below to generate the formal document.</p>
                                </div>
                                <button
                                    type="button"
                                    disabled
                                    title="Voice dictation is not enabled for certificate creation yet."
                                    aria-label="Voice dictation unavailable"
                                    className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined">mic</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {/* Patient selector */}
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

                                {/* Diagnosis */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Diagnosis</label>
                                    <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" placeholder="Enter primary medical diagnosis..." rows="2" />
                                </div>

                                {/* Treatment */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Treatment Given</label>
                                    <textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" placeholder="Detail procedures, medications, or interventions administered..." rows="3" />
                                </div>

                                {/* Recommendations */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recommendations</label>
                                    <textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" placeholder="Rest requirements, follow-up dates, etc..." rows="2" />
                                </div>

                                {/* Date range */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration Start</label>
                                        <input value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" type="date" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duration End</label>
                                        <input value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-xl border-slate-200 bg-white text-sm focus:ring-primary focus:border-primary transition-all p-4" type="date" />
                                    </div>
                                </div>

                                {/* Signature pad */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Digital Signature</label>
                                        <button type="button" onClick={clearSignature} className="text-[10px] font-bold uppercase text-slate-400 hover:text-critical transition-colors">Clear</button>
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

                        {/* Action buttons */}
                        <div className="flex justify-end gap-4">
                            <button type="button" disabled={isSaving} onClick={() => saveCertificate(true)} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                                {isSaving ? 'Saving...' : 'Save as Draft'}
                            </button>
                            <button type="button" disabled={isSaving} onClick={() => saveCertificate(false)} className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 hover:translate-y-[-1px] transition-all disabled:cursor-not-allowed disabled:opacity-50">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                {isSaving ? 'Issuing...' : 'Issue Certificate'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Live Preview */}
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
                                    <h5 className="text-lg font-bold border-b-2 border-slate-100 pb-1 italic">{patientName || '[Patient Name]'}</h5>
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
                                        <p className="text-sm font-bold text-slate-900">{doctorName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize">{doctorRole}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Verification</p>
                                        <p className="mt-1 text-[10px] font-semibold text-slate-500">Saved certificates are verified by their persisted document record.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-35deg]">
                                <span className="text-8xl font-black select-none">{displayName.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button type="button" disabled title="Certificate header uses tenant branding settings." className="flex-1 bg-slate-100 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors disabled:cursor-not-allowed">Header from branding</button>
                            <button type="button" onClick={handlePrint} className="flex-1 bg-slate-100 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-colors">Print Preview</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
