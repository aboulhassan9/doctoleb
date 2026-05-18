import { readCatalog } from './tenantReadiness.ts'
import type { SeedContext } from './types.ts'
import { addDays, increment, isoDate, unwrap } from './seedUtils.ts'

export async function seedInsuranceAndNotifications(context: SeedContext, patients: Record<string, unknown>[]) {
  const providers = await readCatalog(context.operatorClient, 'insurance_providers', 'id, code, name')
  if (providers.length) {
    for (const provider of providers.slice(0, 2)) {
      const { error } = await context.operatorClient
        .from('doctor_insurance_contracts')
        .upsert({
          doctor_id: context.doctor.id,
          provider_id: provider.id,
          doctor_provider_code: `SEED-${context.seedTag.slice(0, 12)}`,
          contract_number: `CN-${context.seedTag}-${String(provider.code || provider.id).slice(0, 6)}`,
          valid_from: isoDate(addDays(new Date(), -180)),
          valid_to: isoDate(addDays(new Date(), 365)),
          is_active: true,
        }, { onConflict: 'doctor_id,provider_id' })
      if (!error) increment(context.counts, 'doctor_insurance_contracts')
    }

    for (let i = 0; i < Math.min(Math.ceil(patients.length * 0.35), patients.length); i++) {
      const provider = providers[i % providers.length]
      const patientBundle = patients[i]
      const patient = patientBundle.patient as Record<string, unknown>
      const policy = await unwrap(
        context.operatorClient
          .from('patient_insurance_policies')
          .insert([{
            patient_id: patient.id,
            provider_id: provider.id,
            policy_number: `POL-${context.seedTag}-${String(i + 1).padStart(3, '0')}`,
            policyholder_name: String(patientBundle.displayName),
            valid_from: isoDate(addDays(new Date(), -90)),
            valid_to: isoDate(addDays(new Date(), 365)),
            is_primary: i === 0,
          }])
          .select('id')
          .single(),
        'seed insurance policy',
      )
      increment(context.counts, 'patient_insurance_policies')

      const { error } = await context.operatorClient
        .from('insurance_claims')
        .insert([{
          patient_id: patient.id,
          doctor_id: context.doctor.id,
          policy_id: policy.id,
          amount: 45 + (i % 4) * 10,
          amount_paid_by_insurer: i % 3 === 0 ? 0 : 30,
          amount_paid_by_patient: i % 3 === 0 ? 0 : 15,
          diagnosis_code: 'SEED',
          status: i % 3 === 0 ? 'submitted' : 'paid',
          submitted_at: addDays(new Date(), -10).toISOString(),
          paid_at: i % 3 === 0 ? null : addDays(new Date(), -2).toISOString(),
          created_by: context.operator.id,
        }])
      if (!error) increment(context.counts, 'insurance_claims')
    }
  }

  for (const patientBundle of patients.slice(0, Math.min(3, patients.length))) {
    const patient = patientBundle.patient as Record<string, unknown>
    const event = await unwrap(
      context.operatorClient
        .from('notification_events')
        .insert([{
          user_id: (patientBundle.user as Record<string, unknown>).id,
          patient_id: patient.id,
          title: 'Visit follow-up ready',
          body: `[seed:${context.seedTag}] Your visit summary and care instructions are ready.`,
          event_type: 'appointment_follow_up',
          severity: 'info',
          status: 'sent',
          created_by: context.operator.id,
          client_request_id: crypto.randomUUID(),
        }])
        .select('id')
        .single(),
      'seed notification event',
    )
    increment(context.counts, 'notification_events')
    await unwrap(
      context.operatorClient
        .from('notification_deliveries')
        .insert([{
          event_id: event.id,
          user_id: (patientBundle.user as Record<string, unknown>).id,
          channel: 'in_app',
          status: 'sent',
          sent_at: new Date().toISOString(),
          client_request_id: crypto.randomUUID(),
        }])
        .select('id')
        .single(),
      'seed notification delivery',
    )
    increment(context.counts, 'notification_deliveries')
  }
}
