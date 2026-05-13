import { useMemo } from 'react';
import { INPUT_CLASS } from '@/lib/styles';

/**
 * PhoneInput — Country-code dropdown + national-number input.
 *
 * Stores the value as a single E.164-style string ("+961 71 234 567" or just
 * "+96171234567") so existing patient/doctor phone fields keep working. The
 * country dropdown is small on purpose — Lebanon-first plus the most common
 * diaspora destinations. Add more entries to COUNTRY_CODES as needed.
 *
 * @param {{
 *   label: string,
 *   name: string,
 *   value?: string,
 *   onChange?: (next: string) => void,
 *   error?: string,
 *   required?: boolean,
 *   disabled?: boolean,
 *   className?: string,
 *   defaultCountryCode?: string,
 *   hint?: string,
 * }} props
 */

const COUNTRY_CODES = [
  { code: '+961', label: 'LB +961' },
  { code: '+971', label: 'AE +971' },
  { code: '+966', label: 'SA +966' },
  { code: '+974', label: 'QA +974' },
  { code: '+33', label: 'FR +33' },
  { code: '+44', label: 'GB +44' },
  { code: '+49', label: 'DE +49' },
  { code: '+1', label: 'US/CA +1' },
];

function splitPhone(value, fallbackCode) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { code: fallbackCode, national: '' };
  if (!raw.startsWith('+')) return { code: fallbackCode, national: raw };

  for (const entry of COUNTRY_CODES) {
    if (raw.startsWith(entry.code)) {
      return {
        code: entry.code,
        national: raw.slice(entry.code.length).trim(),
      };
    }
  }
  const match = raw.match(/^(\+\d{1,4})(.*)$/);
  if (match) return { code: match[1], national: match[2].trim() };
  return { code: fallbackCode, national: raw };
}

function joinPhone(code, national) {
  const cleanedNational = (national ?? '').replace(/[^\d\s().-]/g, '').trim();
  if (!cleanedNational) return '';
  return `${code} ${cleanedNational}`.trim();
}

export default function PhoneInput({
  label,
  name,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  className = '',
  defaultCountryCode = '+961',
  hint,
  placeholder = '71 234 567',
}) {
  const { code, national } = useMemo(
    () => splitPhone(value, defaultCountryCode),
    [value, defaultCountryCode],
  );
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const emit = (nextCode, nextNational) => {
    if (typeof onChange !== 'function') return;
    onChange(joinPhone(nextCode, nextNational));
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className={`flex items-stretch gap-2`}>
        <select
          aria-label={`${label} country code`}
          value={code}
          onChange={(event) => emit(event.target.value, national)}
          disabled={disabled}
          className={`shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          {COUNTRY_CODES.map((entry) => (
            <option key={entry.code} value={entry.code}>{entry.label}</option>
          ))}
        </select>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(event) => emit(code, event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${INPUT_CLASS} ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      </div>
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
