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
  'intake_completed_at',
  'established_at',
  'is_archived',
  'created_at',
  'updated_at',
  `users!patients_user_id_fkey(${USER_CONTACT_FIELDS})`,
].join(', ');

export const APPOINTMENT_BASE_FIELDS = [
  'id',
  'doctor_id',
  'patient_id',
  'clinic_id',
  'visit_type_id',
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
  'clinics(id, name, address, location_type, city_id, phone, map_url, floor, room)',
  'visit_types(id, code, name, default_duration_minutes, requires_intake)',
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
  'location_type',
  'city_id',
  'phone',
  'working_hours',
  'is_primary',
  'notes',
  'latitude',
  'longitude',
  'map_url',
  'floor',
  'room',
  'is_archived',
  'archived_at',
  'archived_by',
  'created_at',
].join(', ');

export const SECRETARY_SLOT_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'clinic_id',
  'schedule_template_id',
  'date',
  'start_time',
  'end_time',
  'is_active',
  'created_by',
  'recurrence_group_id',
  'created_at',
].join(', ');

export const CATALOG_SELECT_FIELDS = [
  'id',
  'code',
  'name',
  'is_system',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

export const CITY_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'country',
].join(', ');

export const OCCUPATION_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'category',
].join(', ');

export const SPECIALTY_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'description',
].join(', ');

export const VACCINE_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'description',
  'typical_doses',
].join(', ');

export const DISEASE_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'icd10_code',
].join(', ');

export const SURGERY_TYPE_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'body_system',
].join(', ');

export const FAMILY_RELATION_SELECT_FIELDS = CATALOG_SELECT_FIELDS;

export const BLOOD_GROUP_SELECT_FIELDS = CATALOG_SELECT_FIELDS;

export const VISIT_TYPE_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'default_duration_minutes',
  'default_fee',
  'requires_intake',
  'billable_service_id',
].join(', ');

export const STAFF_MEMBER_SELECT_FIELDS = [
  'id',
  'user_id',
  'doctor_id',
  'role',
  'display_name',
  'phone',
  'email',
  'invite_status',
  'invite_client_request_id',
  'disabled_previous_invite_status',
  'invite_resent_at',
  'invite_resent_by',
  'invite_resend_count',
  'reactivated_at',
  'reactivated_by',
  'reactivation_count',
  'invite_reissued_at',
  'invite_reissued_by',
  'invite_reissue_count',
  'reports_to',
  'hire_date',
  'is_active',
  'disabled_at',
  'disabled_by',
  'created_at',
  'updated_at',
].join(', ');

export const DOCTOR_SCHEDULE_TEMPLATE_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'clinic_id',
  'weekday',
  'start_time',
  'end_time',
  'slot_duration_minutes',
  'is_active',
  'effective_from',
  'effective_to',
  'created_at',
  'updated_at',
  `clinics(${CLINIC_SELECT_FIELDS})`,
].join(', ');

export const MEDICAL_INTAKE_SELECT_FIELDS = [
  'id',
  'patient_id',
  'status',
  'collected_by',
  'completed_by',
  'completed_at',
  'reopened_by',
  'reopened_at',
  'reopen_reason',
  'occupation_id',
  'occupation_other',
  'blood_group_id',
  'marital_status',
  'living_with',
  'smoking_status',
  'alcohol_use',
  'exercise_frequency',
  'allergies_text',
  'current_medications_text',
  'notes',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const PATIENT_VACCINATION_SELECT_FIELDS = [
  'id',
  'patient_id',
  'vaccine_id',
  'status',
  'given_at',
  'due_at',
  'dose_number',
  'lot_number',
  'administered_by',
  'notes',
  'recorded_by',
  'is_archived',
  'created_at',
  'updated_at',
  `vaccines(${VACCINE_SELECT_FIELDS})`,
].join(', ');

export const PATIENT_SURGERY_SELECT_FIELDS = [
  'id',
  'patient_id',
  'surgery_type_id',
  'performed_at',
  'hospital_name',
  'surgeon_name',
  'notes',
  'recorded_by',
  'is_archived',
  'created_at',
  'updated_at',
  `surgery_types(${SURGERY_TYPE_SELECT_FIELDS})`,
].join(', ');

export const PATIENT_DISEASE_SELECT_FIELDS = [
  'id',
  'patient_id',
  'disease_id',
  'status',
  'severity',
  'diagnosed_at',
  'notes',
  'recorded_by',
  'is_archived',
  'created_at',
  'updated_at',
  `diseases(${DISEASE_SELECT_FIELDS})`,
].join(', ');

export const PATIENT_FAMILY_HISTORY_SELECT_FIELDS = [
  'id',
  'patient_id',
  'relation_id',
  'disease_id',
  'condition_text',
  'age_at_onset',
  'is_deceased',
  'death_cause_disease_id',
  'death_cause_text',
  'notes',
  'recorded_by',
  'is_archived',
  'created_at',
  'updated_at',
  `family_relations(${FAMILY_RELATION_SELECT_FIELDS})`,
].join(', ');

export const INSURANCE_PROVIDER_SELECT_FIELDS = [
  CATALOG_SELECT_FIELDS,
  'phone',
  'email',
  'website_url',
].join(', ');

export const DOCTOR_INSURANCE_CONTRACT_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'provider_id',
  'doctor_provider_code',
  'contract_number',
  'valid_from',
  'valid_to',
  'is_active',
  'created_at',
  'updated_at',
  `insurance_providers(${INSURANCE_PROVIDER_SELECT_FIELDS})`,
].join(', ');

export const PATIENT_INSURANCE_POLICY_SELECT_FIELDS = [
  'id',
  'patient_id',
  'provider_id',
  'policy_number',
  'policyholder_name',
  'valid_from',
  'valid_to',
  'is_primary',
  'created_at',
  'updated_at',
  `insurance_providers(${INSURANCE_PROVIDER_SELECT_FIELDS})`,
].join(', ');

export const CLAIM_FORM_TEMPLATE_SELECT_FIELDS = [
  'id',
  'provider_id',
  'name',
  'description',
  'template_format',
  'template_body',
  'preview_image_url',
  'is_active',
  'is_system',
  'created_at',
  'updated_at',
].join(', ');

export const INSURANCE_CLAIM_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'policy_id',
  'template_id',
  'amount',
  'amount_paid_by_insurer',
  'amount_paid_by_patient',
  'diagnosis_code',
  'claim_form_pdf_url',
  'status',
  'printed_at',
  'submitted_at',
  'paid_at',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export const ENCOUNTER_SELECT_FIELDS = [
  'id',
  'appointment_id',
  'patient_id',
  'doctor_id',
  'clinic_id',
  'visit_type_id',
  'status',
  'started_at',
  'ended_at',
  'chief_complaint',
  'summary',
  'created_by',
  'is_archived',
  'created_at',
  'updated_at',
  `appointments(${APPOINTMENT_BASE_FIELDS})`,
  `patients(${PATIENT_SELECT_FIELDS})`,
  `doctors(${DOCTOR_SELECT_FIELDS})`,
  `clinics(${CLINIC_SELECT_FIELDS})`,
  `visit_types(${VISIT_TYPE_SELECT_FIELDS})`,
].join(', ');

export const CLINICAL_NOTE_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'author_user_id',
  'note_type',
  'content',
  'visibility',
  'is_archived',
  'created_at',
  'updated_at',
  `users!clinical_notes_author_user_id_fkey(${USER_CONTACT_FIELDS})`,
].join(', ');

export const CLINICAL_NOTE_DRAFT_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'author_user_id',
  'note_type',
  'content',
  'status',
  'expires_at',
  'discarded_at',
  'converted_at',
  'converted_note_id',
  'created_at',
  'updated_at',
].join(', ');

export const DIAGNOSIS_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'disease_id',
  'icd10_code',
  'diagnosis_text',
  'diagnosis_type',
  'status',
  'onset_date',
  'resolved_at',
  'notes',
  'recorded_by',
  'is_archived',
  'created_at',
  'updated_at',
  `diseases(${DISEASE_SELECT_FIELDS})`,
].join(', ');

export const MEDICATION_CATALOG_SELECT_FIELDS = [
  'id',
  'name',
  'generic_name',
  'dosage_forms',
  'common_dosages',
  'notes',
  'is_archived',
  'archived_at',
  'archived_by',
  'created_at',
  'updated_at',
].join(', ');

export const PRESCRIPTION_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'medication_name',
  'dosage',
  'route',
  'frequency',
  'duration',
  'instructions',
  'start_date',
  'end_date',
  'status',
  'prescribed_by',
  'medication_catalog_id',
  'is_archived',
  'created_at',
  'updated_at',
  `medication_catalog(${MEDICATION_CATALOG_SELECT_FIELDS})`,
].join(', ');

export const LAB_ORDER_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'title',
  'instructions',
  'status',
  'ordered_at',
  'resulted_at',
  'result_summary',
  'result_document_id',
  'ordered_by',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const IMAGING_ORDER_SELECT_FIELDS = [
  'id',
  'encounter_id',
  'patient_id',
  'doctor_id',
  'imaging_type',
  'body_area',
  'instructions',
  'status',
  'ordered_at',
  'resulted_at',
  'result_summary',
  'result_document_id',
  'ordered_by',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const CLINICAL_DOCUMENT_SELECT_FIELDS = [
  'id',
  'patient_id',
  'encounter_id',
  'doctor_id',
  'document_type',
  'title',
  'content',
  'file_url',
  'status',
  'created_by',
  'finalized_at',
  'finalized_by',
  'voided_at',
  'voided_by',
  'void_reason',
  'client_request_id',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const DOCUMENT_ATTACHMENT_SELECT_FIELDS = [
  'id',
  'document_id',
  'patient_id',
  'uploaded_by',
  'file_url',
  'file_name',
  'mime_type',
  'file_size_bytes',
  'storage_bucket',
  'storage_path',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const CARE_TASK_SELECT_FIELDS = [
  'id',
  'patient_id',
  'encounter_id',
  'appointment_id',
  'assigned_to',
  'created_by',
  'task_type',
  'title',
  'description',
  'due_at',
  'priority',
  'status',
  'completed_at',
  'client_request_id',
  'is_archived',
  'created_at',
  'updated_at',
].join(', ');

export const CONVERSATION_SELECT_FIELDS = [
  'id',
  'patient_id',
  'subject',
  'conversation_type',
  'status',
  'created_by',
  'closed_at',
  'is_archived',
  'created_at',
  'updated_at',
  `patients(${PATIENT_SELECT_FIELDS})`,
].join(', ');

export const CONVERSATION_PARTICIPANT_SELECT_FIELDS = [
  'id',
  'conversation_id',
  'user_id',
  'staff_member_id',
  'patient_id',
  'role',
  'is_active',
  'last_read_at',
  'created_at',
  'updated_at',
  `users!conversation_participants_user_id_fkey(${USER_CONTACT_FIELDS})`,
].join(', ');

export const MESSAGE_SELECT_FIELDS = [
  'id',
  'conversation_id',
  'sender_user_id',
  'sender_patient_id',
  'body',
  'message_type',
  'is_internal',
  'edited_at',
  'deleted_at',
  'redacted_at',
  'redacted_by',
  'client_request_id',
  'created_at',
  'updated_at',
  `users!messages_sender_user_id_fkey(${USER_CONTACT_FIELDS})`,
].join(', ');

export const MESSAGE_ATTACHMENT_SELECT_FIELDS = [
  'id',
  'message_id',
  'uploaded_by',
  'file_url',
  'file_name',
  'mime_type',
  'file_size_bytes',
  'storage_bucket',
  'storage_path',
  'created_at',
  'updated_at',
].join(', ');

export const MESSAGE_READ_RECEIPT_SELECT_FIELDS = [
  'id',
  'message_id',
  'user_id',
  'read_at',
  'created_at',
].join(', ');

export const PATIENT_DEVICE_SELECT_FIELDS = [
  'id',
  'patient_id',
  'user_id',
  'platform',
  'device_label',
  'app_version',
  'locale',
  'timezone',
  'is_active',
  'last_seen_at',
  'created_at',
  'updated_at',
].join(', ');

export const NOTIFICATION_EVENT_SELECT_FIELDS = [
  'id',
  'user_id',
  'patient_id',
  'title',
  'body',
  'event_type',
  'related_type',
  'related_id',
  'severity',
  'status',
  'scheduled_for',
  'created_by',
  'source',
  'client_request_id',
  'created_at',
  'updated_at',
].join(', ');

export const NOTIFICATION_DELIVERY_SELECT_FIELDS = [
  'id',
  'event_id',
  'user_id',
  'device_id',
  'channel',
  'status',
  'provider_message_id',
  'error_message',
  'sent_at',
  'read_at',
  'client_request_id',
  'created_at',
  'updated_at',
].join(', ');

export const REMINDER_RULE_SELECT_FIELDS = [
  'id',
  'code',
  'name',
  'related_type',
  'offset_minutes',
  'channels',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

export const TENANT_PROFILE_SELECT_FIELDS = [
  'id',
  'doctor_id',
  'tenant_slug',
  'display_name',
  'timezone',
  'default_locale',
  'status',
  'schema_version',
  'created_at',
  'updated_at',
].join(', ');

export const TENANT_APP_CONFIG_SELECT_FIELDS = [
  'id',
  'profile_id',
  'app_name',
  'app_tagline',
  'splash_logo_url',
  'icon_url',
  'primary_color',
  'secondary_color',
  'maintenance_message',
  'min_supported_version',
  'force_update_version',
  'enabled_locales',
  'support_phone',
  'support_email',
  'created_at',
  'updated_at',
].join(', ');

export const FEATURE_FLAG_SELECT_FIELDS = [
  'id',
  'code',
  'name',
  'description',
  'audience',
  'is_enabled',
  'target_roles',
  'target_platforms',
  'config',
  'created_at',
  'updated_at',
].join(', ');

export const CONTENT_PAGE_SELECT_FIELDS = [
  'id',
  'slug',
  'title',
  'body_md',
  'audience',
  'status',
  'published_at',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export const CONSENT_DOCUMENT_SELECT_FIELDS = [
  'id',
  'code',
  'title',
  'body_md',
  'version',
  'audience',
  'is_required',
  'is_active',
  'published_at',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export const PATIENT_CONSENT_SELECT_FIELDS = [
  'id',
  'patient_id',
  'consent_document_id',
  'accepted_by_user_id',
  'acceptance_method',
  'accepted_at',
  'revoked_at',
  'created_at',
  'updated_at',
  `consent_documents(${CONSENT_DOCUMENT_SELECT_FIELDS})`,
].join(', ');

export const DOCUMENT_TEMPLATE_SELECT_FIELDS = [
  'id',
  'name',
  'template_type',
  'description',
  'sections',
  'is_default',
  'created_by',
  'is_archived',
  'archived_at',
  'archived_by',
  'created_at',
  'updated_at',
].join(', ');

