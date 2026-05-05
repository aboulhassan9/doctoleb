export const STATE_MACHINES = Object.freeze({
  appointment: {
    scheduled: ['confirmed', 'cancelled', 'no_show'],
    confirmed: ['pre_check', 'cancelled', 'no_show'],
    pre_check: ['in_consultation', 'cancelled'],
    in_consultation: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: [],
  },
  consultation: {
    pending: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },
  referral: {
    pending: ['accepted', 'rejected'],
    accepted: ['in_progress', 'completed'],
    in_progress: ['completed'],
    completed: [],
    rejected: [],
  },
  payment: {
    pending: ['completed', 'failed'],
    completed: ['refunded'],
    failed: [],
    refunded: [],
  },
  precheck: {
    draft: ['submitted'],
    submitted: ['reviewed'],
    reviewed: ['completed'],
    completed: [],
  },
});

export function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function canTransition(entity, from, to) {
  const current = normalizeStatus(from);
  const next = normalizeStatus(to);

  if (!current || !next) return false;
  if (current === next) return true;

  return STATE_MACHINES[entity]?.[current]?.includes(next) ?? false;
}

export function assertTransition(entity, from, to) {
  if (canTransition(entity, from, to)) return null;

  const current = normalizeStatus(from);
  const allowed = STATE_MACHINES[entity]?.[current] || [];
  throw new Error(
    `Invalid ${entity} transition: "${from}" -> "${to}". Allowed: [${allowed.join(', ') || 'none'}]`
  );
}
