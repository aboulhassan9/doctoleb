import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '@ui/components/layouts/DashboardLayout';
import { PageHeader, LoadingSkeleton, EmptyState, Modal, FormField, StatusBadge } from '@ui/components/ui';
import { useAuth } from '@ui/contexts/AuthContext';
import { templateService } from '@core/services/templates';
import { useToast } from '@ui/contexts/ToastContext';
import { stagger, fadeUp } from '@core/lib/animations';
import {
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  documentTemplateCreateSchema,
  documentTemplateUpdateSchema,
} from '@core/schemas/documentTemplates';
import SectionEditor from '../components/templates/SectionEditor';
import TemplatePreview from '../components/templates/TemplatePreview';

function makeBlankSection(index) {
  return {
    key: `section_${index + 1}`,
    title: `Section ${index + 1}`,
    fields: [makeBlankField(0)],
  };
}

function makeBlankField(index) {
  return {
    key: `field_${index + 1}`,
    label: `Field ${index + 1}`,
    type: 'text',
    required: false,
    autofill: null,
    options: null,
    groups: null,
    content: null,
  };
}

export default function TemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isNew = id === 'new';

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [fetchError, setFetchError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('custom');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState([makeBlankSection(0)]);
  const [isDefault, setIsDefault] = useState(false);

  // Load existing template
  useEffect(() => {
    if (isNew) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      const result = await templateService.getById(id);
      if (!isMounted) return;
      if (result.error) {
        setFetchError(result.error);
      } else {
        const t = result.data;
        setTemplate(t);
        setName(t.name || '');
        setTemplateType(t.template_type || 'custom');
        setDescription(t.description || '');
        setSections(t.sections || [makeBlankSection(0)]);
        setIsDefault(t.is_default || false);
      }
      setLoading(false);
    }

    void load();
    return () => { isMounted = false; };
  }, [id, isNew]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');

    const payload = {
      name,
      template_type: templateType,
      description: description || null,
      sections,
    };

    // Validate
    const schema = isNew ? documentTemplateCreateSchema : documentTemplateUpdateSchema;
    const parsed = schema.safeParse(isNew ? { ...payload, created_by: user?.id } : payload);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      setSaveError(messages);
      setSaving(false);
      return;
    }

    const result = isNew
      ? await templateService.create(parsed.data)
      : await templateService.update(id, parsed.data);

    if (result.error) {
      setSaveError(result.error);
      setSaving(false);
      return;
    }

    addToast({ type: 'success', message: isNew ? 'Template created.' : 'Template updated.' });

    if (isNew && result.data?.id) {
      navigate(`/templates/${result.data.id}`, { replace: true });
    } else {
      setTemplate(result.data);
      setSaving(false);
    }
  }, [isNew, id, name, templateType, description, sections, user, navigate, addToast]);

  // Section management
  function addSection() {
    setSections((prev) => [...prev, makeBlankSection(prev.length)]);
  }

  function removeSection(index) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSection(index, updated) {
    setSections((prev) => prev.map((s, i) => i === index ? updated : s));
  }

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6"><LoadingSkeleton rows={10} /></div>
      </DashboardLayout>
    );
  }

  if (fetchError) {
    return (
      <DashboardLayout role="doctor">
        <div className="p-6">
          <EmptyState icon="error" title="Failed to load template" subtitle={fetchError} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 p-6">
        <motion.div variants={fadeUp}>
          <PageHeader
            title={isNew ? 'New Template' : `Edit: ${template?.name || name}`}
            subtitle={isDefault ? 'This is a default template — it cannot be archived.' : undefined}
            actions={
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            }
          />
        </motion.div>

        {/* Save error */}
        {saveError && (
          <motion.div variants={fadeUp} className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {saveError}
          </motion.div>
        )}

        {/* Metadata form */}
        <motion.div variants={fadeUp} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Template Details</h2>
          <FormField label="Name" value={name} onChange={setName} error={!name ? 'Name is required' : ''} />
          <FormField
            label="Type"
            type="select"
            value={templateType}
            onChange={setTemplateType}
            options={TEMPLATE_TYPES.map((t) => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] || t }))}
          />
          <FormField label="Description" type="textarea" value={description || ''} onChange={setDescription} />
          {isDefault && (
            <div className="flex items-center gap-2">
              <StatusBadge status="default" size="sm" />
              <span className="text-sm text-slate-500">Default template — protected from archival</span>
            </div>
          )}
        </motion.div>

        {/* Sections */}
        <motion.div variants={fadeUp} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Sections ({sections.length})</h2>
            <button
              type="button"
              onClick={addSection}
              disabled={sections.length >= 30}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-400"
            >
              + Add Section
            </button>
          </div>

          {sections.map((section, idx) => (
            <SectionEditor
              key={section.key}
              section={section}
              index={idx}
              onChange={(updated) => updateSection(idx, updated)}
              onRemove={() => removeSection(idx)}
              canRemove={sections.length > 1}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Preview modal */}
      {showPreview && (
        <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Template Preview" size="xl">
          <TemplatePreview
            name={name}
            templateType={templateType}
            description={description}
            sections={sections}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
