import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SeedContext } from './types.ts'
import {
  addDays,
  increment,
  isoDate,
  patientDemographics,
  safeErrorMessage,
  seedEmail,
  seededName,
  unwrap,
} from './seedUtils.ts'

async function waitForPublicUser(client: SupabaseClient, email: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await client
      .from('users')
      .select('id, email, first_name, last_name, phone, role, is_active')
      .eq('email', email)
      .maybeSingle()

    if (error) throw new Error(`Public user lookup failed: ${safeErrorMessage(error)}`)
    if (data) return data
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Auth trigger did not create public.users row for a seed patient.')
}

export async function ensureAuthBackedPatient(context: SeedContext, index: number) {
  const { firstName, lastName } = seededName(index)
  const email = seedEmail(context.seedTag, 'patient', index + 1)
  const phone = `+961710${String(index).padStart(5, '0')}`

  const existing = await unwrap(
    context.serviceClient
      .from('users')
      .select('id, email, first_name, last_name, phone, role, is_active')
      .eq('email', email)
      .maybeSingle(),
    'seed user lookup',
  )

  let user = existing
  if (!user) {
    const { error } = await context.serviceClient.auth.admin.createUser({
      email,
      password: `Seed-${crypto.randomUUID()}-DoctoLeb!`,
      email_confirm: true,
      user_metadata: {
        role: 'patient',
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        phone,
      },
    })
    if (error) throw new Error(`Auth seed patient creation failed: ${safeErrorMessage(error)}`)
    user = await waitForPublicUser(context.serviceClient, email)
    increment(context.counts, 'users')
  }

  const demographics = patientDemographics(index)
  await unwrap(
    context.operatorClient
      .from('users')
      .update({ first_name: firstName, last_name: lastName, phone, role: 'patient', is_active: true })
      .eq('id', user.id)
      .select('id')
      .maybeSingle(),
    'seed patient user update',
  )

  let patient = await unwrap(
    context.serviceClient
      .from('patients')
      .select('id, user_id, allergies, intake_completed_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    'seed patient lookup',
  )

  if (!patient) {
    patient = await unwrap(
      context.operatorClient
        .from('patients')
        .insert([{ user_id: user.id, ...demographics }])
        .select('id, user_id, allergies, intake_completed_at')
        .single(),
      'seed patient insert',
    )
    increment(context.counts, 'patients')
  } else {
    patient = await unwrap(
      context.operatorClient
        .from('patients')
        .update(demographics)
        .eq('id', patient.id)
        .select('id, user_id, allergies, intake_completed_at')
        .single(),
      'seed patient update',
    )
  }

  await unwrap(
    context.operatorClient
      .from('medical_intake')
      .upsert({
        patient_id: patient.id,
        status: 'completed',
        collected_by: context.operator.id,
        completed_by: context.operator.id,
        completed_at: new Date().toISOString(),
        marital_status: index % 3 === 0 ? 'married' : 'single',
        living_with: index % 2 === 0 ? 'Family' : 'Alone',
        smoking_status: index % 5 === 0 ? 'former' : 'never',
        alcohol_use: 'none',
        exercise_frequency: index % 4 === 0 ? 'weekly' : 'rare',
        allergies_text: demographics.allergies,
        current_medications_text: index % 4 === 0 ? 'Long-term medication documented in seed intake.' : null,
        notes: `[seed:${context.seedTag}] Completed synthetic intake for dashboard testing.`,
      }, { onConflict: 'patient_id' })
      .select('id')
      .single(),
    'seed medical intake',
  )
  increment(context.counts, 'medical_intake')

  return { user, patient, displayName: `${firstName} ${lastName}` }
}

export async function seedPatientHistory(context: SeedContext, patients: Record<string, unknown>[]) {
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i].patient as Record<string, unknown>
    const disease = context.diseases[i % Math.max(1, context.diseases.length)]
    if (disease?.id) {
      const { error } = await context.operatorClient
        .from('patient_diseases')
        .insert([{
          patient_id: patient.id,
          disease_id: disease.id,
          status: i % 4 === 0 ? 'chronic' : 'resolved',
          severity: ['mild', 'moderate', 'severe'][i % 3],
          diagnosed_at: isoDate(addDays(new Date(), -90 - i)),
          notes: `[seed:${context.seedTag}] Medical history disease record for dashboard testing.`,
          recorded_by: context.operator.id,
        }])
      if (!error) increment(context.counts, 'patient_diseases')
    }

    const relation = context.familyRelations[i % Math.max(1, context.familyRelations.length)]
    if (relation?.id && i % 3 === 0) {
      const { error } = await context.operatorClient
        .from('patient_family_history')
        .insert([{
          patient_id: patient.id,
          relation_id: relation.id,
          disease_id: disease?.id ?? null,
          condition_text: disease?.id ? null : 'Family cardiovascular history',
          age_at_onset: 45 + (i % 30),
          is_deceased: i % 9 === 0,
          notes: `[seed:${context.seedTag}] Family history entry for risk context.`,
          recorded_by: context.operator.id,
        }])
      if (!error) increment(context.counts, 'patient_family_history')
    }
  }
}
