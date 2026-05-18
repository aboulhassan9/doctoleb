import type { SeedContext, SeedPlan } from './types.ts'
import { increment, unwrap } from './seedUtils.ts'

export async function seedConversations(context: SeedContext, patients: Record<string, unknown>[], plan: SeedPlan) {
  for (let i = 0; i < plan.rows.conversations; i++) {
    const patientBundle = patients[i % patients.length]
    const patient = patientBundle.patient as Record<string, unknown>
    const conversation = await unwrap(
      context.operatorClient
        .from('conversations')
        .insert([{
          patient_id: patient.id,
          subject: `[seed:${context.seedTag}] Follow-up conversation ${i + 1}`,
          conversation_type: 'patient_staff',
          status: 'open',
          created_by: context.operator.id,
        }])
        .select('id')
        .single(),
      'seed conversation',
    )
    increment(context.counts, 'conversations')

    await unwrap(
      context.operatorClient
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: context.operator.id, role: String(context.operator.role || 'secretary') },
          { conversation_id: conversation.id, user_id: (patientBundle.user as Record<string, unknown>).id, patient_id: patient.id, role: 'patient' },
        ])
        .select('id'),
      'seed conversation participants',
    )
    increment(context.counts, 'conversation_participants', 2)

    const messageCount = Math.max(2, Math.floor(plan.rows.messages / plan.rows.conversations))
    for (let j = 0; j < messageCount; j++) {
      const fromPatient = j % 2 === 0
      const message = await unwrap(
        context.operatorClient
          .from('messages')
          .insert([{
            conversation_id: conversation.id,
            sender_user_id: fromPatient ? (patientBundle.user as Record<string, unknown>).id : context.operator.id,
            sender_patient_id: fromPatient ? patient.id : null,
            body: fromPatient
              ? `[seed:${context.seedTag}] Patient message ${j + 1}: asking about visit instructions.`
              : `[seed:${context.seedTag}] Staff reply ${j + 1}: care plan confirmed.`,
            message_type: 'text',
            is_internal: false,
            client_request_id: crypto.randomUUID(),
          }])
          .select('id')
          .single(),
        'seed message',
      )
      increment(context.counts, 'messages')

      if (!fromPatient) {
        await unwrap(
          context.operatorClient
            .from('message_read_receipts')
            .upsert({ message_id: message.id, user_id: context.operator.id, read_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' })
            .select('id')
            .single(),
          'seed message read receipt',
        )
        increment(context.counts, 'message_read_receipts')
      }
    }
  }
}
