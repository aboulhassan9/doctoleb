export const DEFAULT_STAFF_MEMBER_ROLE = 'secretary';

export const SUPPORTED_STAFF_MEMBER_ROLES = Object.freeze([
  'secretary',
  'predoctor',
]);

export const SUPPORTED_CONVERSATION_PARTICIPANT_ROLES = Object.freeze([
  'patient',
  'doctor',
  'secretary',
  'predoctor',
  'admin',
]);

export function isSupportedStaffMemberRole(role) {
  return SUPPORTED_STAFF_MEMBER_ROLES.includes(role);
}
