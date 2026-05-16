import {
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_AUTOFILL_KEYS,
} from '@core/schemas/documentTemplates';
import { renderCompositeTemplate } from '@core/lib/composite';
import { SAMPLE_BINDINGS } from '../../lib/sampleRenderContext';

/**
 * Resolve a field's preview value:
 *   - composite_text → substitute against SAMPLE_BINDINGS
 *   - has autofill → show the sample value the autofill points at
 *   - static_text → show its literal content
 *   - otherwise → "—"
 */
function previewValue(field) {
  if (field.type === 'composite_text' && field.template) {
    return renderCompositeTemplate(field.template, SAMPLE_BINDINGS, TEMPLATE_AUTOFILL_KEYS);
  }
  if (field.autofill && SAMPLE_BINDINGS[field.autofill]) {
    return SAMPLE_BINDINGS[field.autofill];
  }
  if (field.type === 'static_text' && field.content) {
    return field.content;
  }
  return '—';
}

/**
 * Renders a read-only preview of the template structure —
 * sections, fields, types, autofill bindings, and required flags.
 */
export default function TemplatePreview({ name, templateType, description, sections }) {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-2">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">{name || 'Untitled Template'}</h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {TEMPLATE_TYPE_LABELS[templateType] || templateType}
          </span>
        </div>
        {description && (
          <p className="text-sm text-slate-500 mt-2">{description}</p>
        )}
      </div>

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-md font-semibold text-slate-800">
            {sIdx + 1}. {section.title}
            <span className="ml-2 text-xs text-slate-400 font-normal">({section.key})</span>
          </h3>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="py-1 text-left font-medium">Label</th>
                <th className="py-1 text-left font-medium">Type</th>
                <th className="py-1 text-left font-medium">Preview value</th>
                <th className="py-1 text-left font-medium">Required</th>
              </tr>
            </thead>
            <tbody>
              {section.fields.map((field, fIdx) => (
                <tr key={fIdx} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-900">{field.label}</td>
                  <td className="py-1.5 text-slate-600">{field.type}</td>
                  <td className="py-1.5 text-slate-700 font-mono text-[12px]">
                    {previewValue(field)}
                  </td>
                  <td className="py-1.5">
                    {field.required ? (
                      <span className="text-red-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {sections.length === 0 && (
        <p className="text-sm text-slate-400 italic">No sections defined yet.</p>
      )}
    </div>
  );
}
