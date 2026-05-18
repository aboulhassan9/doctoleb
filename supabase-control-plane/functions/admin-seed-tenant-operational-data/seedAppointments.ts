import { CHIEF_COMPLAINTS } from './constants.ts'
import { seedClinicalVisit } from './seedClinical.ts'
import type { SeedContext } from './types.ts'
import { appointmentTimeline, hhmm, increment, isoDate, unwrap } from './seedUtils.ts'

export async function seedAppointment(
  context: SeedContext,
  clinic: Record<string, unknown>,
  patientBundle: Record<string, unknown>,
  timeline: ReturnType<typeof appointmentTimeline>[number],
) {
  const patient = patientBundle.patient as Record<string, unknown>
  const visitType = context.visitTypes[0] ?? null
  const slot = await unwrap(
    context.operatorClient
      .from('secretary_slots')
      .insert([{
        doctor_id: context.doctor.id,
        clinic_id: clinic.id,
        date: isoDate(timeline.start),
        start_time: hhmm(timeline.start),
        end_time: hhmm(timeline.end),
        is_active: true,
        created_by: context.operator.id,
      }])
      .select('id')
      .single(),
    'seed slot insert',
  )
  increment(context.counts, 'secretary_slots')

  const appointmentId = await unwrap(
    context.operatorClient.rpc('book_slot', {
      p_slot: slot.id,
      p_patient: patient.id,
      p_booked_by: context.operator.id,
      p_status: 'scheduled',
      p_reason: `[seed:${context.seedTag}] ${CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length]}`,
      p_duration_minutes: 30,
      p_visit_type: visitType?.id ?? null,
    }),
    'seed book_slot',
  )
  increment(context.counts, 'appointments')

  const appointment = await unwrap(
    context.operatorClient
      .from('appointments')
      .select('id, patient_id, doctor_id, clinic_id, status')
      .eq('id', appointmentId)
      .single(),
    'seed appointment fetch',
  )

  if (timeline.outcome === 'cancelled') {
    await unwrap(
      context.operatorClient.rpc('cancel_appointment', {
        appointment_id: appointment.id,
        cancellation_reason: `[seed:${context.seedTag}] Patient requested another date.`,
      }),
      'seed cancel appointment',
    )
    increment(context.counts, 'cancelled_appointments')
    return
  }

  if (timeline.outcome === 'no_show') {
    await unwrap(
      context.operatorClient.from('appointments').update({ status: 'no_show' }).eq('id', appointment.id).select('id').single(),
      'seed no-show appointment',
    )
    increment(context.counts, 'no_show_appointments')
    return
  }

  if (timeline.outcome === 'scheduled_future') {
    increment(context.counts, 'future_appointments')
    return
  }

  await unwrap(
    context.operatorClient.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id).select('id').single(),
    'seed confirm appointment',
  )
  if (timeline.outcome === 'confirmed_future') {
    increment(context.counts, 'future_appointments')
    return
  }

  await unwrap(
    context.operatorClient.from('appointments').update({ status: 'pre_check' }).eq('id', appointment.id).select('id').single(),
    'seed pre-check appointment',
  )

  await unwrap(
    context.doctorClient
      .from('precheck_forms')
      .insert([{
        patient_id: patient.id,
        predoctor_id: null,
        blood_pressure: `${110 + (timeline.index % 20)}/${70 + (timeline.index % 15)}`,
        heart_rate: 64 + (timeline.index % 28),
        temperature: 36.4 + ((timeline.index % 6) / 10),
        weight: 58 + (timeline.index % 35),
        height: 155 + (timeline.index % 35),
        current_medications: timeline.index % 4 === 0 ? 'Existing chronic medication documented.' : 'None reported.',
        allergies: String(patient.allergies || 'No known allergies.'),
        symptoms: `[seed:${context.seedTag}] ${CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length]}`,
        is_urgent: timeline.index % 17 === 0,
        status: 'submitted',
        submitted_at: timeline.start.toISOString(),
      }])
      .select('id')
      .single(),
    'seed precheck',
  )
  increment(context.counts, 'precheck_forms')

  const encounter = await unwrap(
    context.doctorClient.rpc('start_encounter', {
      p_appointment: appointment.id,
      p_chief_complaint: CHIEF_COMPLAINTS[timeline.index % CHIEF_COMPLAINTS.length],
    }),
    'seed start encounter',
  )
  increment(context.counts, 'encounters')

  await seedClinicalVisit(context, appointment, patientBundle, encounter as Record<string, unknown>, timeline.index, timeline.start)

  await unwrap(
    context.doctorClient.rpc('complete_encounter', {
      p_encounter: (encounter as Record<string, unknown>).id,
      p_summary: `[seed:${context.seedTag}] Visit completed. Follow-up plan communicated to patient.`,
    }),
    'seed complete encounter',
  )
  await unwrap(
    context.doctorClient.from('appointments').update({ status: 'completed' }).eq('id', appointment.id).select('id').single(),
    'seed complete appointment',
  )
  increment(context.counts, 'completed_appointments')

  if (timeline.index % 6 !== 0) {
    await unwrap(
      context.operatorClient
        .from('payments')
        .insert([{
          patient_id: patient.id,
          doctor_id: context.doctor.id,
          appointment_id: appointment.id,
          amount: Number(context.doctor.consultation_fee || 45) + (timeline.index % 4) * 5,
          currency: 'USD',
          status: 'completed',
          payment_method: 'cash',
          transaction_id: `${context.seedTag}-${String(timeline.index + 1).padStart(4, '0')}`,
        }])
        .select('id')
        .single(),
      'seed payment',
    )
    increment(context.counts, 'payments')
  }
}
