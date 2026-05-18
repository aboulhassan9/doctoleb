import { FIRST_NAMES, LAST_NAMES } from './constants.ts'
import type { SeedPlan } from './types.ts'

export function safeErrorMessage(error: unknown) {
  const raw = typeof error === 'string'
    ? error
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : JSON.stringify(error)

  return String(raw || 'Unknown error')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/eyJ[a-zA-Z0-9._-]+/g, '[jwt-redacted]')
    .replace(/sb_secret_[a-zA-Z0-9._-]+/g, '[supabase-secret-redacted]')
    .replace(/service[_-]?role[a-zA-Z0-9._-]*/gi, '[service-role-redacted]')
    .slice(0, 900)
}

export function increment(counts: Record<string, number>, key: string, by = 1) {
  counts[key] = (counts[key] ?? 0) + by
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function hhmm(date: Date) {
  return date.toISOString().slice(11, 16)
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000)
}

export function seedEmail(seedTag: string, kind: string, index: number) {
  return `seed.${seedTag}.${kind}${String(index).padStart(3, '0')}@example.invalid`
}

export function seededName(index: number) {
  return {
    firstName: FIRST_NAMES[index % FIRST_NAMES.length],
    lastName: LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length],
  }
}

export function patientDemographics(index: number) {
  const year = 1955 + (index % 48)
  const month = String((index % 12) + 1).padStart(2, '0')
  const day = String((index % 27) + 1).padStart(2, '0')
  const bloodTypes = ['A+', 'A-', 'B+', 'O+', 'O-', 'AB+']

  return {
    date_of_birth: `${year}-${month}-${day}`,
    sex: index % 2 === 0 ? 'female' : 'male',
    blood_type: bloodTypes[index % bloodTypes.length],
    allergies: index % 5 === 0 ? 'Penicillin allergy reported.' : null,
    medical_history: index % 4 === 0 ? 'Chronic condition follow-up documented in seed workload.' : null,
    emergency_contact: `Seed relative ${index + 1}`,
    emergency_phone: `+9617000${String(index).padStart(4, '0')}`,
  }
}

export function appointmentTimeline(plan: SeedPlan, now = new Date()) {
  const rows: { outcome: string; sequence: number }[] = []
  const pastTotal = plan.rows.completedAppointments + plan.rows.cancelledAppointments + plan.rows.noShowAppointments

  for (let i = 0; i < plan.rows.completedAppointments; i++) rows.push({ outcome: 'completed', sequence: i })
  for (let i = 0; i < plan.rows.cancelledAppointments; i++) rows.push({ outcome: 'cancelled', sequence: plan.rows.completedAppointments + i })
  for (let i = 0; i < plan.rows.noShowAppointments; i++) rows.push({ outcome: 'no_show', sequence: plan.rows.completedAppointments + plan.rows.cancelledAppointments + i })
  for (let i = 0; i < plan.rows.futureAppointments; i++) rows.push({ outcome: i % 2 === 0 ? 'confirmed_future' : 'scheduled_future', sequence: pastTotal + i })

  return rows.map((row, index) => {
    const isFuture = row.outcome.endsWith('_future')
    const dayOffset = isFuture ? 1 + (index % 30) : -180 + Math.floor((index / Math.max(1, pastTotal)) * 175)
    const slotNumber = index % 12
    const hour = 8 + Math.floor(slotNumber / 2)
    const minute = slotNumber % 2 === 0 ? 0 : 30
    const start = addDays(now, dayOffset)
    start.setUTCHours(hour, minute, 0, 0)
    return { ...row, index, start, end: addMinutes(start, 30) }
  })
}

export async function unwrap<T>(operation: PromiseLike<{ data: T; error: unknown }>, label: string): Promise<T> {
  const { data, error } = await operation
  if (error) throw new Error(`${label} failed: ${safeErrorMessage(error)}`)
  return data
}
