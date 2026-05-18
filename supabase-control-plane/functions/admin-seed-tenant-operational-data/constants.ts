import type { SeedVolume } from './types.ts'

export const SAFE_TAG = /^[a-z0-9][a-z0-9_-]{2,48}$/
export const SUPABASE_PROJECT_REF = /^[a-z0-9]{20}$/

export const VOLUME_PRESETS: Record<SeedVolume, { patients: number; appointments: number; conversations: number; messagesPerConversation: number }> = {
  tiny: { patients: 5, appointments: 18, conversations: 3, messagesPerConversation: 4 },
  small: { patients: 16, appointments: 80, conversations: 10, messagesPerConversation: 6 },
}

export const REQUIRED_OPERATIONAL_TABLES = [
  'users',
  'doctors',
  'patients',
  'clinics',
  'visit_types',
  'secretary_slots',
  'doctor_schedule_templates',
  'appointments',
  'medical_intake',
  'patient_diseases',
  'patient_family_history',
  'precheck_forms',
  'encounters',
  'clinical_notes',
  'diagnoses',
  'prescriptions',
  'lab_orders',
  'imaging_orders',
  'clinical_documents',
  'care_tasks',
  'conversations',
  'conversation_participants',
  'messages',
  'message_read_receipts',
  'payments',
  'insurance_providers',
  'doctor_insurance_contracts',
  'patient_insurance_policies',
  'insurance_claims',
  'notification_events',
  'notification_deliveries',
]

export const OPTIONAL_ANALYTICS_TABLES = [
  'analytical_reports',
  'analytical_report_versions',
  'analytical_report_runs',
  'analytical_report_shares',
  'analytical_report_schedules',
]

export const CHIEF_COMPLAINTS = [
  'Persistent cough and fatigue for one week',
  'Follow-up for hypertension control',
  'Migraine episodes with nausea',
  'Abdominal discomfort after meals',
  'Medication review and refill',
  'Seasonal allergy flare-up',
  'Lower back pain after exercise',
  'Routine chronic disease follow-up',
]

export const DIAGNOSES = [
  'Upper respiratory tract infection',
  'Essential hypertension',
  'Migraine without aura',
  'Gastroesophageal reflux disease',
  'Seasonal allergic rhinitis',
  'Mechanical lower back pain',
  'Type 2 diabetes mellitus follow-up',
  'Vitamin D deficiency',
]

export const MEDICATIONS = [
  ['Amoxicillin', '500 mg', 'oral', 'three times daily', '7 days'],
  ['Paracetamol', '1 g', 'oral', 'as needed', '3 days'],
  ['Amlodipine', '5 mg', 'oral', 'once daily', '30 days'],
  ['Omeprazole', '20 mg', 'oral', 'once daily before breakfast', '14 days'],
  ['Loratadine', '10 mg', 'oral', 'once daily', '10 days'],
  ['Metformin', '500 mg', 'oral', 'twice daily with meals', '30 days'],
]

export const FIRST_NAMES = ['Maya', 'Karim', 'Nour', 'Ali', 'Lina', 'Hassan', 'Rana', 'Omar', 'Sara', 'Youssef', 'Layal', 'Tarek', 'Mariam', 'Fadi', 'Jana', 'Rami']
export const LAST_NAMES = ['Haddad', 'Khoury', 'Mansour', 'Saad', 'Nasser', 'Karam', 'Farah', 'Sayegh', 'Aoun', 'Saliba', 'Hassan', 'Ibrahim']
