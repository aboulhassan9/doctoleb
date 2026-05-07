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
  encounter: {
    planned: ['in_progress', 'cancelled', 'entered_in_error'],
    in_progress: ['completed', 'cancelled', 'entered_in_error'],
    completed: [],
    cancelled: [],
    entered_in_error: [],
  },
  clinicalDocument: {
    draft: ['final', 'void'],
    final: ['superseded', 'void'],
    superseded: [],
    void: [],
  },
  order: {
    draft: ['ordered', 'cancelled'],
    ordered: ['in_progress', 'resulted', 'cancelled'],
    in_progress: ['resulted', 'cancelled'],
    resulted: [],
    cancelled: [],
  },
  prescription: {
    draft: ['active', 'cancelled'],
    active: ['completed', 'stopped', 'cancelled'],
    completed: [],
    stopped: [],
    cancelled: [],
  },
  careTask: {
    open: ['in_progress', 'done', 'cancelled'],
    in_progress: ['done', 'cancelled'],
    done: [],
    cancelled: [],
  },
});

export const APPOINTMENT_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.appointment));
export const ENCOUNTER_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.encounter));
export const CLINICAL_DOCUMENT_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.clinicalDocument));
export const ORDER_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.order));
export const PRESCRIPTION_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.prescription));
export const CARE_TASK_STATUSES = Object.freeze(Object.keys(STATE_MACHINES.careTask));

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

export const canTransitionEncounter = (from, to) => canTransition('encounter', from, to);
export const canTransitionClinicalDocument = (from, to) => canTransition('clinicalDocument', from, to);
export const canTransitionOrder = (from, to) => canTransition('order', from, to);
export const canTransitionPrescription = (from, to) => canTransition('prescription', from, to);
export const canTransitionCareTask = (from, to) => canTransition('careTask', from, to);
