import { useMemo, useRef } from 'react';
import { FormField } from '@ui/components/ui';
import {
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_AUTOFILL_KEYS,
} from '@core/schemas/documentTemplates';
import {
  extractCompositeBindings,
  renderCompositeTemplate,
} from '@core/lib/composite';
import { SAMPLE_BINDINGS } from '../../lib/sampleRenderContext';

const FIELD_TYPE_LABELS = {
  text: 'Text',
  textarea: 'Text Area',
  date: 'Date',
  select: 'Select',
  checkbox: 'Checkbox',
  checkbox_grid: 'Checkbox Grid',
  static_text: 'Static Text',
  composite_text: 'Composite (from other fields)',
  signature: 'Signature',
};

// Friendlier labels for the binding chips in the composite-text editor.
// Keep keys in lockstep with TEMPLATE_AUTOFILL_KEYS in
// packages/core/schemas/documentTemplates.js.
const BINDING_LABELS = {
  'patient.full_name': 'Patient name',
  'patient.date_of_birth': 'Patient DOB',
  'patient.sex': 'Patient sex',
  'patient.gender': 'Patient gender',
  'patient.phone': 'Patient phone',
  'patient.email': 'Patient email',
  'doctor.full_name': 'Doctor name',
  'doctor.specialization': 'Doctor specialty',
  'doctor.license_number': 'Doctor license #',
  'clinic.name': 'Clinic name',
  'clinic.address': 'Clinic address',
  'clinic.phone': 'Clinic phone',
  'tenant.display_name': 'Tenant name',
  'tenant.support_phone': 'Support phone',
  'tenant.support_email': 'Support email',
  'encounter.chief_complaint': 'Chief complaint',
  'encounter.summary': 'Encounter summary',
  'encounter.started_at': 'Encounter date',
  'document.created_at': 'Document date',
};

export default function FieldEditor({ field, index, onChange, onRemove, canRemove }) {
  const templateTextareaRef = useRef(null);

  function update(key, value) {
    onChange({ ...field, [key]: value });
  }

  // When type changes to select, ensure options array exists
  function handleTypeChange(newType) {
    const updated = { ...field, type: newType };
    if (newType === 'select' && !Array.isArray(updated.options)) {
      updated.options = ['Option 1'];
    }
    if (newType === 'checkbox_grid' && !Array.isArray(updated.groups)) {
      updated.groups = [{ label: 'Group 1', items: ['Item 1'] }];
    }
    if (newType === 'static_text' && !updated.content) {
      updated.content = '';
    }
    if (newType === 'composite_text' && !updated.template) {
      // Seed a friendly starter so the doctor sees the syntax immediately.
      updated.template = '{{patient.full_name}} — born {{patient.date_of_birth}}';
    }
    // Clear irrelevant props per-type for clean persisted JSON.
    if (newType !== 'select') updated.options = null;
    if (newType !== 'checkbox_grid') updated.groups = null;
    if (newType !== 'static_text') updated.content = null;
    if (newType !== 'composite_text') updated.template = null;
    // Composite handles its own binding via `{{...}}` placeholders, so its
    // top-level `autofill` is meaningless. Clear it to avoid confusion.
    if (newType === 'composite_text') updated.autofill = null;
    onChange(updated);
  }

  /**
   * Insert a `{{binding}}` chip at the current caret position inside the
   * composite-text template textarea. Falls back to appending at the end
   * if the ref isn't ready yet (e.g. first click after type switch).
   */
  function insertBinding(bindingKey) {
    const placeholder = `{{${bindingKey}}}`;
    const textarea = templateTextareaRef.current;
    const current = field.template || '';
    if (!textarea) {
      update('template', current + placeholder);
      return;
    }
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = current.slice(0, start) + placeholder + current.slice(end);
    update('template', next);
    // Restore caret position just after the inserted placeholder.
    requestAnimationFrame(() => {
      const pos = start + placeholder.length;
      try {
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
      } catch {
        /* selection APIs may throw on unmounted nodes — silent. */
      }
    });
  }

  // Real-time invalid-binding list for the composite editor.
  const compositeBindingsUsed = field.type === 'composite_text'
    ? extractCompositeBindings(field.template || '')
    : [];
  const compositeUnknownBindings = compositeBindingsUsed.filter(
    (b) => !TEMPLATE_AUTOFILL_KEYS.includes(b),
  );

  // Live preview — substitutes the same way the renderer does, but against
  // the curated `SAMPLE_BINDINGS` so doctors see exactly what shape they're
  // building. Memoized so we only re-substitute when the template changes.
  const compositePreview = useMemo(() => {
    if (field.type !== 'composite_text' || !field.template) return '';
    return renderCompositeTemplate(field.template, SAMPLE_BINDINGS, TEMPLATE_AUTOFILL_KEYS);
  }, [field.type, field.template]);

  return (
    <div className="rounded-lg border border-slate-150 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Field {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormField label="Key" value={field.key} onChange={(v) => update('key', v)} />
        <FormField label="Label" value={field.label} onChange={(v) => update('label', v)} />
        <FormField
          label="Type"
          type="select"
          value={field.type}
          onChange={handleTypeChange}
          options={TEMPLATE_FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] || t }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Autofill"
          type="select"
          value={field.autofill || ''}
          onChange={(v) => update('autofill', v || null)}
          options={[
            { value: '', label: '— None —' },
            ...TEMPLATE_AUTOFILL_KEYS.map((k) => ({ value: k, label: k })),
          ]}
        />
        <div className="flex items-center gap-2 pt-5">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={field.required || false}
              onChange={(e) => update('required', e.target.checked)}
              className="rounded border-slate-300"
            />
            Required
          </label>
        </div>
      </div>

      {/* Type-specific options */}
      {field.type === 'select' && Array.isArray(field.options) && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Options</label>
          {field.options.map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const newOpts = [...field.options];
                  newOpts[optIdx] = e.target.value;
                  update('options', newOpts);
                }}
                className="rounded border border-slate-300 px-2 py-1 text-sm flex-1"
              />
              <button
                type="button"
                onClick={() => update('options', field.options.filter((_, i) => i !== optIdx))}
                className="text-xs text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('options', [...field.options, `Option ${field.options.length + 1}`])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add Option
          </button>
        </div>
      )}

      {field.type === 'checkbox_grid' && Array.isArray(field.groups) && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Groups</label>
          {field.groups.map((group, gIdx) => (
            <div key={gIdx} className="rounded border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.label}
                  onChange={(e) => {
                    const newGroups = [...field.groups];
                    newGroups[gIdx] = { ...group, label: e.target.value };
                    update('groups', newGroups);
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm flex-1"
                  placeholder="Group label"
                />
                <button
                  type="button"
                  onClick={() => update('groups', field.groups.filter((_, i) => i !== gIdx))}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
              {group.items.map((item, iIdx) => (
                <div key={iIdx} className="flex items-center gap-2 ml-4">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newGroups = [...field.groups];
                      newGroups[gIdx] = {
                        ...group,
                        items: group.items.map((it, i) => i === iIdx ? e.target.value : it),
                      };
                      update('groups', newGroups);
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newGroups = [...field.groups];
                      newGroups[gIdx] = {
                        ...group,
                        items: group.items.filter((_, i) => i !== iIdx),
                      };
                      update('groups', newGroups);
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newGroups = [...field.groups];
                  newGroups[gIdx] = { ...group, items: [...group.items, `Item ${group.items.length + 1}`] };
                  update('groups', newGroups);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 ml-4"
              >
                + Add Item
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('groups', [...field.groups, { label: `Group ${field.groups.length + 1}`, items: ['Item 1'] }])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add Group
          </button>
        </div>
      )}

      {field.type === 'static_text' && (
        <FormField
          label="Static Content"
          type="textarea"
          value={field.content || ''}
          onChange={(v) => update('content', v)}
        />
      )}

      {/* Optional inline hint shown only in the editor — never appears in
          the rendered PDF. Lets template authors leave guidance for the
          next editor without polluting the doctor-facing label. */}
      <FormField
        label="Hint (editor only)"
        value={field.hint || ''}
        onChange={(v) => update('hint', v || null)}
        placeholder="e.g. Use SI units."
      />

      {/* Conditional display — "Show only when…" */}
      <div className="rounded border border-slate-150 bg-white p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!field.show_if}
            onChange={(e) => {
              if (e.target.checked) {
                update('show_if', { binding: TEMPLATE_AUTOFILL_KEYS[0], equals: '' });
              } else {
                update('show_if', null);
              }
            }}
            id={`show-if-${field.key}`}
            className="rounded border-slate-300"
          />
          <label htmlFor={`show-if-${field.key}`} className="text-sm font-medium text-slate-700">
            Show only when…
          </label>
        </div>
        {field.show_if && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <FormField
              label="Binding"
              type="select"
              value={field.show_if.binding}
              onChange={(v) => update('show_if', { ...field.show_if, binding: v })}
              options={TEMPLATE_AUTOFILL_KEYS.map((k) => ({
                value: k,
                label: BINDING_LABELS[k] || k,
              }))}
            />
            <FormField
              label="Equals (case-insensitive)"
              value={field.show_if.equals || ''}
              onChange={(v) => update('show_if', { ...field.show_if, equals: v })}
              placeholder="e.g. female"
            />
          </div>
        )}
      </div>

      {field.type === 'composite_text' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Composite template
          </label>
          <p className="text-xs text-slate-500">
            Mix free text and live data. Click a chip below to insert a
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">
              {'{{binding}}'}
            </code>
            placeholder where the caret is.
          </p>
          <textarea
            ref={templateTextareaRef}
            value={field.template || ''}
            onChange={(e) => update('template', e.target.value)}
            rows={3}
            placeholder="Example: {{patient.full_name}} — born {{patient.date_of_birth}}"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TEMPLATE_AUTOFILL_KEYS.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => insertBinding(b)}
                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                title={b}
              >
                + {BINDING_LABELS[b] || b}
              </button>
            ))}
          </div>
          {compositeUnknownBindings.length > 0 && (
            <p className="text-xs text-red-600">
              Unknown binding{compositeUnknownBindings.length > 1 ? 's' : ''}:{' '}
              {compositeUnknownBindings.map((b) => (
                <code key={b} className="mx-1 rounded bg-red-50 px-1">{b}</code>
              ))}
              — only the listed bindings are accepted.
            </p>
          )}
          {compositePreview && (
            <p className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
              <span className="font-medium text-slate-500">Preview:</span>{' '}
              <span className="font-mono">{compositePreview}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}