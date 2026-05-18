import { CHIEF_COMPLAINTS, DIAGNOSES, MEDICATIONS } from './constants.ts'
import type { SeedContext } from './types.ts'
import { addDays, increment, isoDate, unwrap } from './seedUtils.ts'

async function createFinalDocument(context: SeedContext, payload: Record<string, unknown>) {
  const document = await unwrap(
    context.doctorClient
      .from('clinical_documents')
      .insert([{ ...payload, status: 'draft' }])
      .select('id, status')
      .single(),
    'seed clinical document insert',
  )
  await unwrap(
    context.doctorClient.rpc('finalize_clinical_document', { p_document: document.id }),
    'seed clinical document finalize',
  )
  increment(context.counts, 'clinical_documents')
}

export async function seedClinicalVisit(
  context: SeedContext,
  appointment: Record<string, unknown>,
  patientBundle: Record<string, unknown>,
  encounter: Record<string, unknown>,
  index: number,
  at: Date,
) {
  const patient = patientBundle.patient as Record<string, unknown>
  const complaint = CHIEF_COMPLAINTS[index % CHIEF_COMPLAINTS.length]
  const diagnosisText = DIAGNOSES[index % DIAGNOSES.length]
  const disease = context.diseases[index % Math.max(1, context.diseases.length)]

  await unwrap(
    context.doctorClient
      .from('clinical_notes')
      .insert([{
        encounter_id: encounter.id,
        patient_id: patient.id,
        doctor_id: context.doctor.id,
        author_user_id: context.doctor.user_id,
        note_type: 'general',
        content: `[seed:${context.seedTag}] ${complaint}. Vitals stable. Patient advised on follow-up and warning signs.`,
        visibility: 'clinical',
      }])
      .select('id')
      .single(),
    'seed clinical note',
  )
  increment(context.counts, 'clinical_notes')

  await unwrap(
    context.doctorClient
      .from('diagnoses')
      .insert([{
        encounter_id: encounter.id,
        patient_id: patient.id,
        doctor_id: context.doctor.id,
        disease_id: disease?.id ?? null,
        diagnosis_text: diagnosisText,
        diagnosis_type: 'primary',
        status: index % 7 === 0 ? 'resolved' : 'active',
        onset_date: isoDate(addDays(at, -3)),
        notes: `[seed:${context.seedTag}] Diagnosis generated for operational dashboard testing.`,
        recorded_by: context.doctor.user_id,
      }])
      .select('id')
      .single(),
    'seed diagnosis',
  )
  increment(context.counts, 'diagnoses')

  if (index % 4 !== 0) {
    const [medication_name, dosage, route, frequency, duration] = MEDICATIONS[index % MEDICATIONS.length]
    await unwrap(
      context.doctorClient
        .from('prescriptions')
        .insert([{
          encounter_id: encounter.id,
          patient_id: patient.id,
          doctor_id: context.doctor.id,
          medication_name,
          dosage,
          route,
          frequency,
          duration,
          instructions: `[seed:${context.seedTag}] Take as prescribed. Review if symptoms worsen.`,
          start_date: isoDate(at),
          status: 'active',
          prescribed_by: context.doctor.user_id,
        }])
        .select('id')
        .single(),
      'seed prescription',
    )
    increment(context.counts, 'prescriptions')
  }

  if (index % 3 === 0) {
    await unwrap(
      context.doctorClient
        .from('lab_orders')
        .insert([{
          encounter_id: encounter.id,
          patient_id: patient.id,
          doctor_id: context.doctor.id,
          title: index % 2 === 0 ? 'CBC with differential' : 'Basic metabolic panel',
          instructions: `[seed:${context.seedTag}] Routine lab follow-up.`,
          status: 'ordered',
          ordered_at: at.toISOString(),
          ordered_by: context.doctor.user_id,
        }])
        .select('id')
        .single(),
      'seed lab order',
    )
    increment(context.counts, 'lab_orders')
  }

  if (index % 7 === 0) {
    await unwrap(
      context.doctorClient
        .from('imaging_orders')
        .insert([{
          encounter_id: encounter.id,
          patient_id: patient.id,
          doctor_id: context.doctor.id,
          imaging_type: 'Ultrasound',
          body_area: 'Abdomen',
          instructions: `[seed:${context.seedTag}] Imaging requested after clinical assessment.`,
          status: 'ordered',
          ordered_at: at.toISOString(),
          ordered_by: context.doctor.user_id,
        }])
        .select('id')
        .single(),
      'seed imaging order',
    )
    increment(context.counts, 'imaging_orders')
  }

  if (index % 2 === 0) {
    await createFinalDocument(context, {
      patient_id: patient.id,
      encounter_id: encounter.id,
      doctor_id: context.doctor.id,
      document_type: 'report',
      title: `Seed Medical Report ${index + 1} (${context.seedTag})`,
      content: `[seed:${context.seedTag}] Medical report for ${patientBundle.displayName}. Main assessment: ${diagnosisText}.`,
      created_by: context.doctor.user_id,
      client_request_id: crypto.randomUUID(),
    })
  }

  if (index % 4 === 0) {
    await createFinalDocument(context, {
      patient_id: patient.id,
      encounter_id: encounter.id,
      doctor_id: context.doctor.id,
      document_type: 'referral',
      title: `Seed Referral Letter ${index + 1} (${context.seedTag})`,
      content: `[seed:${context.seedTag}] Referral for specialist review after ${diagnosisText.toLowerCase()}.`,
      created_by: context.doctor.user_id,
      client_request_id: crypto.randomUUID(),
    })
  }

  if (index % 5 === 0) {
    const task = await unwrap(
      context.doctorClient
        .from('care_tasks')
        .insert([{
          patient_id: patient.id,
          encounter_id: encounter.id,
          appointment_id: appointment.id,
          assigned_to: context.doctor.user_id,
          created_by: context.doctor.user_id,
          task_type: 'follow_up',
          title: `Follow up with ${patientBundle.displayName}`,
          description: `[seed:${context.seedTag}] Call patient to review symptoms and lab readiness.`,
          due_at: addDays(at, 7).toISOString(),
          priority: index % 10 === 0 ? 'high' : 'normal',
          status: 'open',
          client_request_id: crypto.randomUUID(),
        }])
        .select('id')
        .single(),
      'seed care task',
    )
    increment(context.counts, 'care_tasks')
    if (task?.id && index % 10 !== 0) {
      await unwrap(
        context.doctorClient
          .from('care_tasks')
          .update({ status: 'done', completed_at: addDays(at, 1).toISOString() })
          .eq('id', task.id)
          .select('id')
          .single(),
        'seed care task complete',
      )
    }
  }
}
