import { motion } from 'framer-motion';
import { FormField } from '@ui/components/ui';
import FieldEditor from './FieldEditor';
import { fadeUp } from '@core/lib/animations';

export default function SectionEditor({ section, index, onChange, onRemove, canRemove }) {
  function updateTitle(value) {
    onChange({ ...section, title: value });
  }

  function updateKey(value) {
    onChange({ ...section, key: value });
  }

  function updateFields(updatedFields) {
    onChange({ ...section, fields: updatedFields });
  }

  function addField() {
    updateFields([...section.fields, {
      key: `field_${section.fields.length + 1}`,
      label: `Field ${section.fields.length + 1}`,
      type: 'text',
      required: false,
      autofill: null,
      options: null,
      groups: null,
      content: null,
    }]);
  }

  function removeField(fieldIndex) {
    updateFields(section.fields.filter((_, i) => i !== fieldIndex));
  }

  function updateField(fieldIndex, updatedField) {
    updateFields(section.fields.map((f, i) => i === fieldIndex ? updatedField : f));
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-slate-900">
          Section {index + 1}: {section.title}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Remove Section
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Section Key" value={section.key} onChange={updateKey} />
        <FormField label="Section Title" value={section.title} onChange={updateTitle} />
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Fields ({section.fields.length})</span>
          <button
            type="button"
            onClick={addField}
            disabled={section.fields.length >= 25}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-slate-400"
          >
            + Add Field
          </button>
        </div>

        {section.fields.map((field, fieldIdx) => (
          <FieldEditor
            key={field.key}
            field={field}
            index={fieldIdx}
            onChange={(updated) => updateField(fieldIdx, updated)}
            onRemove={() => removeField(fieldIdx)}
            canRemove={section.fields.length > 1}
          />
        ))}
      </div>
    </motion.div>
  );
}
