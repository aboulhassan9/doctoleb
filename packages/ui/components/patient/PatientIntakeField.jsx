import {
  BadgeDollarSign,
  BadgeHelp,
  CalendarDays,
  ChevronDown,
  ClipboardPlus,
  ContactRound,
  Droplets,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  Pill,
  Receipt,
  ShieldAlert,
  Stethoscope,
  Timer,
  User,
  UserRound,
} from 'lucide-react';

const ICONS = {
  'badge-dollar-sign': BadgeDollarSign,
  'badge-help': BadgeHelp,
  'calendar-days': CalendarDays,
  'clipboard-plus': ClipboardPlus,
  'contact-round': ContactRound,
  droplets: Droplets,
  mail: Mail,
  'message-circle': MessageCircle,
  phone: Phone,
  'phone-call': PhoneCall,
  pill: Pill,
  receipt: Receipt,
  'shield-alert': ShieldAlert,
  stethoscope: Stethoscope,
  timer: Timer,
  user: User,
  'user-round': UserRound,
};

function RequiredMark({ required }) {
  if (!required) {
    return (
      <span className="bg-[color-mix(in_srgb,var(--patient-surface)_76%,white)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--patient-muted)]">
        Optional
      </span>
    );
  }
  return (
    <span className="bg-[color-mix(in_srgb,var(--patient-sage)_14%,var(--patient-surface))] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--patient-sage)]">
      Required
    </span>
  );
}

export function PatientIntakeField({ field, value, onChange, disabled = false }) {
  const inputId = `patient-onboarding-${field.key}`;
  const helpId = `${inputId}-help`;
  const Icon = ICONS[field.icon] || BadgeHelp;
  const baseClass =
    'patient-field-input peer px-0 py-3 shadow-none disabled:opacity-55';
  const withIconClass = `${baseClass} pl-8`;

  const handleChange = (event) => onChange(field.key, event.target.value);
  const fieldValue = value || '';
  const describedBy = field.helpText ? helpId : undefined;

  return (
    <div className="group space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-black text-[var(--patient-ink)]">
          {field.label}
        </label>
        <RequiredMark required={field.required} />
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-0 top-3.5 z-10 text-[var(--patient-muted)] transition group-focus-within:text-[var(--patient-sage)]">
          <Icon className="h-4 w-4" />
        </span>

        {field.type === 'textarea' ? (
          <textarea
            id={inputId}
            value={fieldValue}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
            rows={field.rows || 3}
            placeholder={field.placeholder}
            aria-describedby={describedBy}
            className={`${withIconClass} resize-none leading-relaxed`}
          />
        ) : field.type === 'select' ? (
          <>
            <select
              id={inputId}
              value={fieldValue}
              onChange={handleChange}
              disabled={disabled}
              required={field.required}
              aria-describedby={describedBy}
              className={`${withIconClass} appearance-none pr-10`}
            >
              <option value="">Select...</option>
              {(field.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-0 top-3.5 z-10 text-[var(--patient-muted)] transition group-focus-within:text-[var(--patient-sage)]"
              aria-hidden="true"
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </>
        ) : (
          <input
            id={inputId}
            type={field.type || 'text'}
            value={fieldValue}
            onChange={handleChange}
            disabled={disabled}
            required={field.required}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            aria-describedby={describedBy}
            className={withIconClass}
          />
        )}
      </div>

      {field.helpText && (
        <p id={helpId} className="text-xs font-semibold leading-5 text-[var(--patient-muted)]">
          {field.helpText}
        </p>
      )}
    </div>
  );
}
