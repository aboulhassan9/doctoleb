import type { SeedContext } from './types.ts'
import { addDays, increment, isoDate, unwrap } from './seedUtils.ts'

export async function ensureClinic(context: SeedContext) {
  const name = `DoctoLeb Seed Clinic (${context.seedTag})`
  const existing = await unwrap(
    context.operatorClient
      .from('clinics')
      .select('id, name, address')
      .eq('name', name)
      .maybeSingle(),
    'seed clinic lookup',
  )
  if (existing) return existing

  const clinic = await unwrap(
    context.operatorClient
      .from('clinics')
      .insert([{
        name,
        address: 'Seeded operational data location, Beirut',
        location_type: 'private_clinic',
        phone: '+96171000000',
        is_primary: false,
        notes: `[seed:${context.seedTag}] Synthetic clinic for dashboard workload testing.`,
      }])
      .select('id, name, address')
      .single(),
    'seed clinic insert',
  )
  increment(context.counts, 'clinics')
  return clinic
}

export async function ensureScheduleTemplates(context: SeedContext, clinicId: string) {
  const specs = [
    { weekday: 1, start_time: '08:00', end_time: '12:00', slot_duration_minutes: 30 },
    { weekday: 3, start_time: '13:00', end_time: '17:00', slot_duration_minutes: 30 },
    { weekday: 5, start_time: '09:00', end_time: '14:00', slot_duration_minutes: 30 },
  ]

  for (const spec of specs) {
    const existing = await unwrap(
      context.operatorClient
        .from('doctor_schedule_templates')
        .select('id')
        .eq('doctor_id', context.doctor.id)
        .eq('clinic_id', clinicId)
        .eq('weekday', spec.weekday)
        .eq('start_time', spec.start_time)
        .maybeSingle(),
      'seed schedule template lookup',
    )
    if (existing) continue

    await unwrap(
      context.operatorClient
        .from('doctor_schedule_templates')
        .insert([{
          doctor_id: context.doctor.id,
          clinic_id: clinicId,
          ...spec,
          is_active: true,
          effective_from: isoDate(addDays(new Date(), -180)),
        }])
        .select('id')
        .single(),
      'seed schedule template insert',
    )
    increment(context.counts, 'doctor_schedule_templates')
  }
}
