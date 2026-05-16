import { useId } from 'react';
import { INPUT_CLASS, SELECT_CLASS, TEXTAREA_CLASS } from '@/lib/styles';

/**
 * FormField — Label + input + error message in one component.
 *
 * Ensures every form field has a proper <label> (accessibility).
 * Replaces scattered placeholder-only inputs across forms.
 *
 * @param {{ label: string, name: string, type?: string, value?: string, onChange?: (e) => void, error?: string, required?: boolean, placeholder?: string, options?: Array<{value: string, label: string}>, rows?: number, className?: string, children?: React.ReactNode }} props
 */
export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  required = false,
  placeholder,
  options,
  rows,
  className = '',
  children,
  ...rest
}) {
  const reactId = useId();
  const id = name ? `field-${name}` : reactId;

  const renderInput = () => {
    if (children) return children;

    if (type === 'select' && options) {
      return (
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          className={`${SELECT_CLASS} ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows || 4}
          className={`${TEXTAREA_CLASS} ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
      );
    }

    return (
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${INPUT_CLASS} ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''}`}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
    );
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {renderInput()}
      {hint && !error && (
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
