export const USER_PUBLIC_FIELDS = 'id, email, first_name, last_name, phone, initials, role, is_active, avatar_url, created_at, updated_at';

export const USER_CONTACT_FIELDS = 'id, email, first_name, last_name, phone, initials';

export const DOCTOR_SELECT_FIELDS = [
  'id',
  'user_id',
  'department',
  'specialization',
  'license_number',
  'bio',
  'consultation_fee',
  'availability',
  'created_at',
  'updated_at',
  `users!doctors_user_id_fkey(${USER_CONTACT_FIELDS})`,
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
  'is_archived',
  'created_at',
  'updated_at',
  `users!patients_user_id_fkey(${USER_CONTACT_FIELDS})`,
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
  'treatment_plan',
  'notes',
  'medications',
  'status',
  'session_start',
  'session_end',
  'is_archived',
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
  'file_url',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const CERTIFICATE_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'certificate_type',
  'title',
  'issuer',
  'issue_date',
  'expiry_date',
  'file_url',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const REFERRAL_SELECT_FIELDS = [
  'id',
  'patient_id',
  'from_doctor_id',
  'to_doctor_id',
  'reason',
  'status',
  'referred_at',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const NOTIFICATION_SELECT_FIELDS = [
  'id',
  'user_id',
  'title',
  'message',
  'type',
  'is_read',
  'related_id',
  'created_at',
].join(', ');

export const PRECHECK_SELECT_FIELDS = [
  'id',
  'patient_id',
  'predoctor_id',
  'blood_pressure',
  'heart_rate',
  'temperature',
  'weight',
  'height',
  'current_medications',
  'allergies',
  'symptoms',
  'status',
  'submitted_at',
  'image_url',
  'is_urgent',
  'created_at',
  'updated_at',
].join(', ');

export const PAYMENT_SELECT_FIELDS = [
  'id',
  'patient_id',
  'doctor_id',
  'appointment_id',
  'amount',
  'currency',
  'status',
  'payment_method',
  'transaction_id',
  'created_at',
  'updated_at',
].join(', ');

export const BILLABLE_SERVICE_FIELDS = [
  'id',
  'code',
  'name',
  'description',
  'price',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

export const CLINIC_SELECT_FIELDS = [
  'id',
  'name',
  'address',
  'created_at',
].join(', ');

export const CLINIC_SETTINGS_SELECT_FIELDS = [
  'id',
  'clinic_name',
  'doctor_id',
  'phone',
  'email',
  'address',
  'working_hours',
  'created_at',
  'updated_at',
].join(', ');

export const DOCTOR_DASHBOARD_SUMMARY_FIELDS = [
  'total_patients',
  'upcoming_appointments',
  'completed_consultations',
  'overdue_appointments',
].join(', ');

export const SECRETARY_SLOT_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'clinic_id',
  'date',
  'start_time',
  'end_time',
  'is_active',
  'created_by',
  'recurrence_group_id',
  'created_at',
].join(', ');
