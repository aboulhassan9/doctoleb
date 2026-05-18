import { seedAppointment } from './seedAppointments.ts'
import { seedConversations } from './seedCommunications.ts'
import { seedInsuranceAndNotifications } from './seedInsuranceNotifications.ts'
import { ensureAuthBackedPatient, seedPatientHistory } from './seedPatients.ts'
import { ensureClinic, ensureScheduleTemplates } from './seedScheduling.ts'
import { appointmentTimeline } from './seedUtils.ts'
import type { SeedContext, SeedPlan } from './types.ts'

export async function executeSeed(context: SeedContext, plan: SeedPlan) {
  const clinic = await ensureClinic(context)
  await ensureScheduleTemplates(context, String(clinic.id))

  const patients: Record<string, unknown>[] = []
  for (let i = 0; i < plan.rows.patients; i++) {
    patients.push(await ensureAuthBackedPatient(context, i))
  }
  await seedPatientHistory(context, patients)

  for (const timeline of appointmentTimeline(plan)) {
    await seedAppointment(context, clinic, patients[timeline.index % patients.length], timeline)
  }

  await seedConversations(context, patients, plan)
  await seedInsuranceAndNotifications(context, patients)

  return { counts: context.counts }
}
