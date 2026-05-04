export const USER_PUBLIC_FIELDS = 'id, email, first_name, last_name, phone, initials, role, is_active';

export const USER_CONTACT_FIELDS = 'id, email, first_name, last_name, phone, initials';

export const DOCTOR_SELECT_FIELDS = [
  'id',
  'user_id',
  'department',
  'specialization',
  'consultation_fee',
  `users(${USER_CONTACT_FIELDS})`,
].join(', ');

export const PATIENT_SELECT_FIELDS = [
  'id',
  'user_id',
  'date_of_birth',
  'sex',
  'blood_type',
  'allergies',
  'medical_history',
  'insurance_id',
  'emergency_contact',
  'emergency_phone',
  `users(${USER_CONTACT_FIELDS})`,
].join(', ');

export const APPOINTMENT_BASE_FIELDS = [
  'id',
  'doctor_id',
  'patient_id',
  'scheduled_at',
  'duration_minutes',
  'status',
  'reason',
  'notes',
  'created_at',
  'updated_at',
  'slot_id',
  'booked_by',
].join(', ');

export const APPOINTMENT_SELECT_FIELDS = [
  APPOINTMENT_BASE_FIELDS,
  `doctors(${DOCTOR_SELECT_FIELDS})`,
  `patients(${PATIENT_SELECT_FIELDS})`,
].join(', ');

export const CONSULTATION_SELECT_FIELDS = [
  'id',
  'appointment_id',
  'doctor_id',
  'patient_id',
  'diagnosis',
  'symptoms',
  'notes',
  'medications',
  'status',
  'session_start',
  'session_end',
  'follow_up_date',
  'created_at',
  'updated_at',
].join(', ');

export const CONSULTATION_WITH_RELATIONS = [
  CONSULTATION_SELECT_FIELDS,
  `doctors(${DOCTOR_SELECT_FIELDS})`,
  `patients(${PATIENT_SELECT_FIELDS})`,
  `appointments(${APPOINTMENT_BASE_FIELDS})`,
].join(', ');

export const REPORT_SELECT_FIELDS = [
  'id',
  'patient_id',
  'doctor_id',
  'report_type',
  'title',
  'content',
  'findings',
  'created_at',
  'updated_at',
].join(', ');

export const CERTIFICATE_SELECT_FIELDS = [
  'id',
  'patient_id',
  'doctor_id',
  'certificate_type',
  'title',
  'content',
  'issue_date',
  'created_at',
  'updated_at',
].join(', ');

export const REFERRAL_SELECT_FIELDS = [
  'id',
  'patient_id',
  'from_doctor_id',
  'to_doctor_id',
  'reason',
  'notes',
  'status',
  'priority',
  'referred_at',
  'created_at',
  'updated_at',
].join(', ');

