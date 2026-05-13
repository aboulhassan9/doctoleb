import { INPUT_CLASS } from '@/lib/styles';

/**
 * DatePickerInput — Label + native date input + error in one component.
 *
 * Drop-in for hand-rolled `<input type="date">` blocks. Keeps the input
 * accessible (real <label>, aria-invalid, aria-describedby) and applies the
 * shared INPUT_CLASS so date pickers don't drift from the rest of the UI.
 *
 * @param {{
 *   label: string,
 *   name: string,
 *   value?: string,
 *   onChange?: (e) => void,
 *   error?: string,
 *   required?: boolean,
 *   min?: string,
 *   max?: string,
 *   disabled?: boolean,
 *   className?: string,
 *   hint?: string,
 * }} props
 */
export default function DatePickerInput({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
  min,
  max,
  disabled = false,
  className = '',
  hint,
  ...rest
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type="date"
        value={value ?? ''}
        onChange={onChange}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`${INPUT_CLASS} ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
