import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { insuranceService } from '@core/services/insurance';
import { patientService } from '@core/services/patients';
import { useToast } from '@ui/contexts/ToastContext';
import { useBrand } from '@ui/contexts/BrandContext';
import { openPrintableHtml, replaceHtmlTokens } from '@core/lib/html';

/**
 * DoctorClaimPage — Generate, preview, and print insurance claims.
 * Workflow: select patient → select policy → select template → fill → preview → print/save.
 * Tier 1 §1.7 insurance claim generation.
 */
export default function DoctorClaimPage() {
  const { showToast } = useToast();
  const brand = useBrand();

  // Steps: 'select-patient' → 'fill-claim' → 'preview'
  const [step, setStep] = useState('select-patient');

  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [form, setForm] = useState({
    diagnosis: '',
    amount: '',
    notes: '',
  });

  const [previewHtml, setPreviewHtml] = useState('');

  // Load patients on search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientSearch.length < 2) { setPatients([]); return; }
      setLoadingPatients(true);
      const { data } = await patientService.search(patientSearch);
      setPatients(data || []);
      setLoadingPatients(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Load policies + templates when patient selected
  useEffect(() => {
    if (!selectedPatient) return;
    (async () => {
      const [polRes, tplRes, clmRes] = await Promise.all([
        insuranceService.getPatientPolicies(selectedPatient.id),
        insuranceService.getClaimTemplates({ activeOnly: true }),
        insuranceService.getClaimsByPatient(selectedPatient.id),
      ]);
      setPolicies(polRes.data || []);
      setTemplates(tplRes.data || []);
      setClaims(clmRes.data || []);
    })();
  }, [selectedPatient]);

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setStep('fill-claim');
  };

  const generatePreview = useCallback(() => {
    if (!selectedTemplate || !selectedPatient) return;

    const html = replaceHtmlTokens(selectedTemplate.template_body || '', {
      '{{patient_name}}': `${selectedPatient.first_name} ${selectedPatient.last_name}`,
      '{{doctor_name}}': brand.displayName || 'Doctor',
      '{{clinic_name}}': brand.displayName || 'Clinic',
      '{{policy_number}}': selectedPolicy?.policy_number || 'N/A',
      '{{provider_code}}': selectedPolicy?.insurance_providers?.provider_code || 'N/A',
      '{{diagnosis}}': form.diagnosis || 'N/A',
      '{{amount}}': form.amount || '0.00',
      '{{date}}': new Date().toLocaleDateString('en-GB'),
    });

    setPreviewHtml(html);
    setStep('preview');
  }, [selectedTemplate, selectedPatient, selectedPolicy, form, brand]);

  const saveClaim = async () => {
    if (!selectedPatient || !selectedPolicy) {
      showToast('Select a patient and policy first', 'error');
      return;
    }

    const { data, error } = await insuranceService.createClaim({
      patient_id: selectedPatient.id,
      policy_id: selectedPolicy.id,
      provider_id: selectedPolicy.provider_id,
      status: 'draft',
      amount: parseFloat(form.amount) || 0,
      diagnosis_text: form.diagnosis,
      notes: form.notes,
      claim_form_template_id: selectedTemplate?.id || null,
    });

    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Claim saved as draft', 'success');
      setClaims(prev => [data, ...prev]);
    }
  };

  const handlePrint = () => {
    if (!openPrintableHtml(previewHtml)) {
      showToast('Unable to open print preview. Please allow popups for this site.', 'error');
    }
  };

  const reset = () => {
    setStep('select-patient');
    setSelectedPatient(null);
    setSelectedPolicy(null);
    setSelectedTemplate(null);
    setForm({ diagnosis: '', amount: '', notes: '' });
    setPreviewHtml('');
    setPatientSearch('');
    setClaims([]);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Insurance Claims</h1>
          <p className="text-slate-500 text-sm mt-1">Generate, preview, and print insurance claim forms.</p>
        </div>
        {step !== 'select-patient' && (
          <button onClick={reset} className="text-sm text-primary hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Start Over
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Select Patient', 'Fill Claim', 'Preview & Print'].map((label, i) => {
          const stepNames = ['select-patient', 'fill-claim', 'preview'];
          const isActive = step === stepNames[i];
          const isDone = stepNames.indexOf(step) > i;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${isDone ? 'bg-primary' : 'bg-slate-200'}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition ${
                isActive ? 'bg-primary text-white' : isDone ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
              }`}>
                <span className="material-symbols-outlined text-base">
                  {isDone ? 'check_circle' : i === 0 ? 'person_search' : i === 1 ? 'edit_note' : 'print'}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: Select Patient */}
      {step === 'select-patient' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="relative mb-4">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
            <input
              type="text"
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Search patients by name (min 2 characters)…"
              autoFocus
            />
          </div>

          {loadingPatients && <p className="text-sm text-slate-400 py-4 text-center">Searching…</p>}

          {patients.length > 0 && (
            <div className="grid gap-2">
              {patients.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  className="bg-white border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition cursor-pointer flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-400">{p.phone || p.email || 'No contact'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* STEP 2: Fill Claim */}
      {step === 'fill-claim' && selectedPatient && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Patient card */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
              {selectedPatient.first_name?.[0]}{selectedPatient.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{selectedPatient.first_name} {selectedPatient.last_name}</p>
              <p className="text-xs text-slate-500">{selectedPatient.phone || selectedPatient.email}</p>
            </div>
          </div>

          {/* Policy selection */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Insurance Policy</label>
            {policies.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                ⚠️ No insurance policies found for this patient. Add one first.
              </p>
            ) : (
              <div className="grid gap-2">
                {policies.map(pol => (
                  <div
                    key={pol.id}
                    onClick={() => setSelectedPolicy(pol)}
                    className={`border rounded-xl p-4 cursor-pointer transition ${
                      selectedPolicy?.id === pol.id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {pol.insurance_providers?.name || 'Unknown Provider'}
                          {pol.is_primary && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Primary</span>}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Policy # {pol.policy_number || 'N/A'}</p>
                      </div>
                      {selectedPolicy?.id === pol.id && (
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template selection */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Claim Form Template</label>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400">No templates available. Create one in Claim Templates.</p>
            ) : (
              <select
                value={selectedTemplate?.id || ''}
                onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Claim details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Diagnosis</label>
              <input
                type="text"
                value={form.diagnosis}
                onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Upper respiratory infection"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Amount (USD)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Additional notes for the claim…"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={generatePreview}
              disabled={!selectedPolicy || !selectedTemplate}
              className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">preview</span>
              Preview Claim Form
            </button>
            <button
              onClick={saveClaim}
              disabled={!selectedPolicy}
              className="px-5 py-2.5 border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Save as Draft
            </button>
          </div>

          {/* Previous claims for this patient */}
          {claims.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">Previous Claims</h3>
              <div className="bg-slate-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="py-2 px-4 text-left font-medium">Date</th>
                      <th className="py-2 px-4 text-left font-medium">Status</th>
                      <th className="py-2 px-4 text-left font-medium">Amount</th>
                      <th className="py-2 px-4 text-left font-medium">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map(c => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="py-2 px-4 text-slate-600">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            c.status === 'approved' ? 'bg-green-100 text-green-700' :
                            c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            c.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{c.status}</span>
                        </td>
                        <td className="py-2 px-4 text-slate-700">${c.amount || 0}</td>
                        <td className="py-2 px-4 text-slate-500 truncate max-w-[200px]">{c.diagnosis_text || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* STEP 3: Preview & Print */}
      {step === 'preview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setStep('fill-claim')}
              className="text-sm text-slate-600 hover:text-primary flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Edit
            </button>
            <div className="flex gap-3">
              <button
                onClick={saveClaim}
                className="px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary/5 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">save</span>
                Save Draft
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-lg p-2">
            <iframe
              srcDoc={previewHtml}
              title="Claim Preview"
              className="w-full h-[600px] rounded-xl border-0"
              sandbox=""
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
