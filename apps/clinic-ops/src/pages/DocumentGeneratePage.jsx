/**
 * DocumentGeneratePage — Dynamic document fill/generate page.
 *
 * Loads a template definition and auto-renders a fill form from
 * template.sections[].fields[]. NOT hardcoded per template type —
 * works for ANY template definition with any field types.
 *
 * Flow:
 *   1. Load template by ID from route params
 *   2. Select patient (required) and optionally encounter
 *   3. Dynamic form renders from template.sections[].fields[]
 *   4. Autofill fields pre-populate from patient/doctor/encounter context
 *   5. Submit → create clinical_document (draft) → render PDF → finalize
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { PageHeader, FormField, SearchableSelect, StatusBadge, LoadingSkeleton, EmptyState, ConfirmDialog } from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { useToast } from '@ui/contexts/ToastContext';
import { usePatients } from '@core/hooks/features/usePatients';
import { useDoctorProfile } from '@core/hooks/features/useDoctorProfile';
import { templateService } from '@core/services/templates';
import { clinicalService } from '@core/services/clinical';
import { documentService } from '@core/services/documents';
import { TEMPLATE_TYPE_LABELS, TEMPLATE_AUTOFILL_KEYS } from '@core/schemas/documentTemplates';
import { evaluateDerivation } from '@core/lib/composite';
import { stagger, fadeUp } from '@core/lib/animations';
import { logError } from '@/lib/logger';

// ── Autofill context resolver ──────────────────────────────────────
// Maps TEMPLATE_AUTOFILL_KEYS to live data from patient/doctor/encounter/tenant.

function buildAutofillContext({ patient, doctor, encounter, tenant }) {
  const ctx = {};
  const p = patient || {};
  const pUser = p.users || {};
  const d = doctor || {};
  const dUser = d.users || {};
  const e = encounter || {};
  const t = tenant || {};

  ctx['patient.full_name'] = `${pUser.first_name || ''} ${pUser.last_name || ''}`.trim();
  ctx['patient.date_of_birth'] = p.date_of_birth || '';
  ctx['patient.sex'] = p.sex || '';
  ctx['patient.gender'] = p.sex || ''; // legacy alias
  ctx['patient.phone'] = pUser.phone || '';
  ctx['patient.email'] = pUser.email || '';
  ctx['doctor.full_name'] = `${dUser.first_name || ''} ${dUser.last_name || ''}`.trim();
  ctx['doctor.specialization'] = d.specialization || '';
  ctx['doctor.license_number'] = d.license_number || '';
  ctx['clinic.name'] = t.clinic_name || '';
  ctx['clinic.address'] = t.clinic_address || '';
  ctx['clinic.phone'] = t.clinic_phone || '';
  ctx['tenant.display_name'] = t.display_name || '';
  ctx['tenant.support_phone'] = t.support_phone || '';
  ctx['tenant.support_email'] = t.support_email || '';
  ctx['tenant.timezone'] = t.timezone || 'Asia/Beirut';
  ctx['encounter.chief_complaint'] = e.chief_complaint || '';
  ctx['encounter.summary'] = e.summary || '';
  ctx['encounter.started_at'] = e.started_at || '';
  ctx['document.created_at'] = new Date().toISOString().split('T')[0];

  return ctx;
}

// ── Composite text resolver ────────────────────────────────────────

function resolveCompositeText(templateStr, autofillCtx) {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/g, (match, key) => {
    return autofillCtx[key] || match;
  });
}

// ── Field type → form input renderer ──────────────────────────────

function DynamicField({ field, value, onChange, autofillCtx, errors }) {
  const fieldKey = field.key;
  const fieldError = errors[fieldKey] || '';

  // Read-only field types — no user input needed
  if (field.type === 'static_text') {
    return (
      <div className="py-2">
        <p className="text-sm font-medium text-slate-700 mb-1">{field.label}</p>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
          {field.content || '—'}
        </p>
      </div>
    );
  }

  if (field.type === 'composite_text') {
    const resolved = resolveCompositeText(field.template, autofillCtx);
    return (
      <div className="py-2">
        <p className="text-sm font-medium text-slate-700 mb-1">{field.label}</p>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
          {resolved || '—'}
        </p>
        {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
      </div>
    );
  }

  if (field.type === 'derived') {
    const resolved = evaluateDerivation(field.derivation, autofillCtx);
    return (
      <div className="py-2">
        <p className="text-sm font-medium text-slate-700 mb-1">{field.label}</p>
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
          {resolved ?? '—'}
        </p>
      </div>
    );
  }

  // Autofill fields — pre-populated, shown as read-only with the resolved value
  if (field.autofill && field.type === 'text') {
    const autofillValue = autofillCtx[field.autofill] || '';
    return (
      <FormField
        label={field.label}
        name={fieldKey}
        type="text"
        value={autofillValue}
        onChange={onChange}
        required={field.required}
        hint={field.hint || `Auto-filled from ${field.autofill}`}
        error={fieldError}
        readOnly
        className="opacity-90"
      />
    );
  }

  // Editable field types
  if (field.type === 'text') {
    return (
      <FormField
        label={field.label}
        name={fieldKey}
        type="text"
        value={value || ''}
        onChange={onChange}
        required={field.required}
        placeholder={field.hint || `Enter ${field.label}`}
        error={fieldError}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <FormField
        label={field.label}
        name={fieldKey}
        type="textarea"
        value={value || ''}
        onChange={onChange}
        required={field.required}
        placeholder={field.hint || `Enter ${field.label}`}
        rows={4}
        error={fieldError}
      />
    );
  }

  if (field.type === 'date') {
    // Autofill date fields
    if (field.autofill) {
      const autofillValue = autofillCtx[field.autofill] || '';
      return (
        <FormField
          label={field.label}
          name={fieldKey}
          type="date"
          value={autofillValue}
          onChange={onChange}
          required={field.required}
          hint={field.hint || `Auto-filled from ${field.autofill}`}
          error={fieldError}
          readOnly
          className="opacity-90"
        />
      );
    }
    return (
      <FormField
        label={field.label}
        name={fieldKey}
        type="date"
        value={value || ''}
        onChange={onChange}
        required={field.required}
        error={fieldError}
      />
    );
  }

  if (field.type === 'select') {
    const options = (field.options || []).map((opt) => ({ value: opt, label: opt }));
    return (
      <FormField
        label={field.label}
        name={fieldKey}
        type="select"
        value={value || ''}
        onChange={onChange}
        required={field.required}
        options={options}
        placeholder={`Select ${field.label}`}
        error={fieldError}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="py-2 flex items-center gap-3">
        <input
          type="checkbox"
          id={`field-${fieldKey}`}
          name={fieldKey}
          checked={value || false}
          onChange={(e) => onChange({ target: { name: fieldKey, value: e.target.checked, type: 'checkbox' } })}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={`field-${fieldKey}`} className="text-sm font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
      </div>
    );
  }

  if (field.type === 'checkbox_grid') {
    const groups = field.groups || [];
    const checkedItems = value || {};
    return (
      <div className="py-2 space-y-4">
        <p className="text-sm font-medium text-slate-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        {groups.map((group) => (
          <div key={group.label} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">{group.label}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {group.items.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedItems[item] || false}
                    onChange={(e) => {
                      const next = { ...checkedItems, [item]: e.target.checked };
                      onChange({ target: { name: fieldKey, value: next, type: 'checkbox_grid' } });
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        ))}
        {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
      </div>
    );
  }

  if (field.type === 'signature') {
    return (
      <div className="py-2">
        <p className="text-sm font-medium text-slate-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white text-center">
          <p className="text-xs text-slate-400 mb-2">Signature will be captured at finalization</p>
          {field.autofill && (
            <p className="text-sm text-slate-600 italic">
              Auto-signed: {autofillCtx[field.autofill] || '—'}
            </p>
          )}
        </div>
        {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
      </div>
    );
  }

  // Fallback for unknown types
  return (
    <div className="py-2">
      <p className="text-sm font-medium text-slate-700 mb-1">{field.label}</p>
      <p className="text-xs text-slate-400">Unsupported field type: {field.type}</p>
    </div>
  );
}

// ── Main page component ────────────────────────────────────────────

export default function DocumentGeneratePage() {
  const { id: templateId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Context selectors
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedEncounter, setSelectedEncounter] = useState(null);

  // Form state: flat map of sectionKey.fieldKey → value
  const [fieldValues, setFieldValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Data hooks
  const { patients } = usePatients();
  const { doctorId, doctor } = useDoctorProfile();

  // Load template
  useEffect(() => {
    let isMounted = true;
    async function loadTemplate() {
      setLoading(true);
      const { data, error: err } = await templateService.getById(templateId);
      if (!isMounted) return;
      if (err || !data) {
        setError(err || 'Template not found.');
        setTemplate(null);
      } else {
        setTemplate(data);
        setError('');
        // Initialize field values with defaults
        const defaults = {};
        for (const section of data.sections || []) {
          for (const field of section.fields || []) {
            const fvKey = `${section.key}.${field.key}`;
            if (field.type === 'checkbox') defaults[fvKey] = false;
            else if (field.type === 'checkbox_grid') defaults[fvKey] = {};
            else if (field.type === 'select' && field.options?.length) defaults[fvKey] = '';
            else defaults[fvKey] = '';
          }
        }
        setFieldValues(defaults);
      }
      setLoading(false);
    }
    void loadTemplate();
    return () => { isMounted = false; };
  }, [templateId]);

  // Build autofill context from selected patient, doctor, encounter
  const autofillCtx = useMemo(() => {
    return buildAutofillContext({
      patient: selectedPatient,
      doctor: doctor,
      encounter: selectedEncounter,
      tenant: {}, // tenant context comes from the Edge Function at render time
    });
  }, [selectedPatient, doctor, selectedEncounter]);

  // Handle field value changes
  const handleFieldChange = useCallback((valueOrEvent, event) => {
    const sourceEvent = event || valueOrEvent;
    const { name } = sourceEvent.target || {};
    if (!name) return;
    const value = event ? valueOrEvent : sourceEvent.target.value;
    setFieldValues((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }, [fieldErrors]);

  // Validate required fields
  function validateFields() {
    const errs = {};
    if (!selectedPatient) {
      errs._patient = 'Please select a patient.';
    }
    if (!template) return errs;

    for (const section of template.sections || []) {
      for (const field of section.fields || []) {
        if (!field.required) continue;
        // Skip read-only/auto-filled types
        if (['static_text', 'composite_text', 'derived'].includes(field.type)) continue;
        // Skip autofill text/date fields — they're pre-populated
        if (field.autofill && ['text', 'date'].includes(field.type)) continue;

        const fvKey = `${section.key}.${field.key}`;
        const val = fieldValues[fvKey];

        if (field.type === 'checkbox_grid') {
          const checkedCount = Object.values(val || {}).filter(Boolean).length;
          if (checkedCount === 0) errs[fvKey] = `${field.label} requires at least one selection.`;
        } else if (field.type === 'checkbox') {
          if (!val) errs[fvKey] = `${field.label} is required.`;
        } else if (field.type === 'select') {
          if (!val || val === '') errs[fvKey] = `${field.label} is required.`;
        } else {
          if (!val || val.trim() === '') errs[fvKey] = `${field.label} is required.`;
        }
      }
    }
    return errs;
  }

  // Build document content from field values + template definition
  function buildDocumentContent() {
    if (!template) return '';
    const lines = [];
    for (const section of template.sections || []) {
      lines.push(`── ${section.title} ──`);
      for (const field of section.fields || []) {
        const fvKey = `${section.key}.${field.key}`;
        let displayValue;

        if (field.type === 'static_text') {
          displayValue = field.content || '';
        } else if (field.type === 'composite_text') {
          displayValue = resolveCompositeText(field.template, autofillCtx);
        } else if (field.type === 'derived') {
          displayValue = evaluateDerivation(field.derivation, autofillCtx) ?? '';
        } else if (field.autofill && ['text', 'date'].includes(field.type)) {
          displayValue = autofillCtx[field.autofill] || '';
        } else if (field.type === 'checkbox_grid') {
          const checked = Object.entries(fieldValues[fvKey] || {})
            .filter(([, v]) => v)
            .map(([k]) => k);
          displayValue = checked.length > 0 ? checked.join(', ') : 'None selected';
        } else if (field.type === 'checkbox') {
          displayValue = fieldValues[fvKey] ? 'Yes' : 'No';
        } else if (field.type === 'signature') {
          displayValue = field.autofill ? `Signed: ${autofillCtx[field.autofill] || '—'}` : 'Pending signature';
        } else {
          displayValue = fieldValues[fvKey] || '';
        }

        if (displayValue && displayValue.trim()) {
          lines.push(`${field.label}: ${displayValue}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // Submit handler
  async function handleSubmit() {
    const errs = validateFields();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    try {
      const documentType = templateService.coerceDocumentType(template.template_type);
      const content = buildDocumentContent();

      const payload = {
        patient_id: selectedPatient.id,
        encounter_id: selectedEncounter?.id || null,
        doctor_id: doctorId || null,
        document_type: documentType,
        title: `${template.name} — ${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim(),
        content,
        template_id: template.id,
        created_by: user?.id,
      };

      const { data: doc, error: createErr } = await documentService.create(payload);
      if (createErr || !doc) {
        showToast(createErr || 'Failed to create document.', 'error');
        setIsSaving(false);
        return;
      }

      // Attempt PDF render via Edge Function
      try {
        const { data: renderData, error: renderErr } = await clinicalService.finalizeClinicalDocument(doc.id);
        if (renderErr) {
          showToast('Document saved as draft. PDF generation will be available after finalization.', 'info');
        } else {
          showToast('Document created and finalized successfully!', 'success');
        }
      } catch {
        showToast('Document saved as draft. You can finalize it later.', 'info');
      }

      navigate('/templates');
    } catch (err) {
      logError('DocumentGeneratePage.handleSubmit', err);
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleSaveDraft() {
    if (!selectedPatient) {
      setFieldErrors({ _patient: 'Please select a patient to save a draft.' });
      showToast('Please select a patient.', 'error');
      return;
    }

    setIsSaving(true);
    const documentType = templateService.coerceDocumentType(template.template_type);
    const content = buildDocumentContent();

    const payload = {
      patient_id: selectedPatient.id,
      encounter_id: selectedEncounter?.id || null,
      doctor_id: doctorId || null,
      document_type: documentType,
      title: `[Draft] ${template.name} — ${selectedPatient.users?.first_name || ''} ${selectedPatient.users?.last_name || ''}`.trim(),
      content,
      template_id: template.id,
      created_by: user?.id,
    };

    documentService.create(payload).then(({ data, error: err }) => {
      if (err || !data) {
        showToast(err || 'Failed to save draft.', 'error');
      } else {
        showToast('Draft saved successfully.', 'success');
        navigate('/templates');
      }
      setIsSaving(false);
    });
  }

  function handleDiscard() {
    setShowDiscardConfirm(true);
  }

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <LoadingSkeleton rows={8} />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !template) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <EmptyState icon="description" title="Template not found" subtitle={error || 'The requested template does not exist.'} />
        </div>
      </DashboardLayout>
    );
  }

  const typeLabel = TEMPLATE_TYPE_LABELS[template.template_type] || template.template_type;

  // Patient options for SearchableSelect
  const patientOptions = (patients || []).map((p) => ({
    value: p.id,
    label: `${p.users?.first_name || ''} ${p.users?.last_name || ''}`.trim(),
    subtitle: p.date_of_birth ? `DOB: ${p.date_of_birth}` : '',
  }));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={`Generate ${typeLabel}`}
          subtitle={template.name}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/templates')}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Back to Templates
              </button>
            </div>
          }
        />

        {/* Patient & Encounter Selection */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Patient & Encounter</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Patient <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={patientOptions}
                value={selectedPatient?.id || ''}
                onChange={(option) => {
                  const patient = patients?.find((p) => p.id === option?.value);
                  setSelectedPatient(patient || null);
                  setSelectedEncounter(null); // reset encounter when patient changes
                  if (fieldErrors._patient) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next._patient;
                      return next;
                    });
                  }
                }}
                placeholder="Search patient..."
              />
              {fieldErrors._patient && <p className="text-xs text-red-500 mt-1">{fieldErrors._patient}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Encounter <span className="text-xs text-slate-400">(optional)</span>
              </label>
              <select
                value={selectedEncounter?.id || ''}
                onChange={(e) => {
                  // In a full implementation, this would load encounters for the selected patient
                  setSelectedEncounter(e.target.value ? { id: e.target.value } : null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={!selectedPatient}
              >
                <option value="">No encounter linked</option>
                {selectedPatient && <option value="current">Current encounter</option>}
              </select>
            </div>
          </div>

          {selectedPatient && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">
                  {selectedPatient.users?.first_name} {selectedPatient.users?.last_name}
                </p>
                <p className="text-xs text-blue-600">
                  {selectedPatient.date_of_birth && `DOB: ${selectedPatient.date_of_birth}`}
                  {selectedPatient.sex && ` · ${selectedPatient.sex}`}
                </p>
              </div>
              <StatusBadge status="selected" size="sm" />
            </div>
          )}
        </motion.div>

        {/* Dynamic Form Sections */}
        {template.sections.map((section, sectionIdx) => (
          <motion.div
            key={section.key}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: sectionIdx * 0.05 }}
            className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              {section.title}
            </h3>

            <div className="space-y-3">
              {section.fields.map((field) => {
                const fvKey = `${section.key}.${field.key}`;
                // Check show_if condition
                if (field.show_if) {
                  const bindingValue = autofillCtx[field.show_if.binding] || '';
                  const equalsValue = field.show_if.equals || '';
                  if (bindingValue.toLowerCase().trim() !== equalsValue.toLowerCase().trim()) {
                    return null; // skip field when condition not met
                  }
                }

                return (
                  <DynamicField
                    key={fvKey}
                    field={field}
                    value={fieldValues[fvKey]}
                    onChange={handleFieldChange}
                    autofillCtx={autofillCtx}
                    errors={fieldErrors}
                  />
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Action Buttons */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Discard
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isSaving ? 'Creating...' : 'Create & Finalize'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Discard confirmation */}
        {showDiscardConfirm && (
          <ConfirmDialog
            title="Discard document?"
            message="All filled fields will be lost. This action cannot be undone."
            confirmLabel="Discard"
            variant="danger"
            onConfirm={() => {
              setShowDiscardConfirm(false);
              navigate('/templates');
            }}
            onCancel={() => setShowDiscardConfirm(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
