export const CLINIC_TIME_ZONE = 'Asia/Beirut';

function normalizeTimestampInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeTimeValue(value) {
  if (!value) return '';

  const [hours = '00', minutes = '00'] = String(value).split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function combineSlotDateAndTime(slotDate, slotTime) {
  if (!slotDate || !slotTime) return null;

  return `${slotDate}T${normalizeTimeValue(slotTime)}:00`;
}

export function parseClinicDateTime(value) {
  return normalizeTimestampInput(value);
}

export function formatClinicDate(value, options = {}) {
  const parsed = parseClinicDateTime(value);
  if (!parsed) return '';

  return parsed.toLocaleDateString('en-US', options);
}

export function formatClinicTime(value, options = {}) {
  const parsed = parseClinicDateTime(value);
  if (!parsed) return '';

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function isFutureClinicDateTime(value, now = new Date()) {
  const parsed = parseClinicDateTime(value);
  if (!parsed) return false;

  return parsed.getTime() > now.getTime();
}

export function isSameClinicDay(value, referenceDate = new Date()) {
  const parsed = parseClinicDateTime(value);
  if (!parsed) return false;

  return parsed.toDateString() === referenceDate.toDateString();
}
