import { supabase } from '@/lib/supabase';
import {
  CONVERSATION_PARTICIPANT_SELECT_FIELDS,
  CONVERSATION_SELECT_FIELDS,
  MESSAGE_ATTACHMENT_SELECT_FIELDS,
  MESSAGE_READ_RECEIPT_SELECT_FIELDS,
  MESSAGE_SELECT_FIELDS,
} from '@/lib/selects';
import {
  conversationCreateSchema,
  conversationParticipantSchema,
  messageAttachmentSchema,
  messageCreateSchema,
} from '@/schemas';
import { apiCall, apiPaged } from './api';
import { STORAGE_BUCKETS, storageService } from './storage';
import { validationError, parse } from '@/lib/serviceHelpers';

function isDuplicateClientRequestIdError(error) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === '23505'
    && (
      message.includes('idx_messages_client_request_id_unique')
      || message.includes('messages_client_request_id')
      || message.includes('client_request_id')
    )
  );
}

export const messagingService = {
  async getConversations({ patientId = null, status = null, limit = null, page = 1, pageSize = 25 } = {}) {
    let query = supabase
      .from('conversations')
      .select(CONVERSATION_SELECT_FIELDS, { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (patientId) query = query.eq('patient_id', patientId);
    if (status) query = query.eq('status', status);

    return apiPaged(query, { page, pageSize: limit ?? pageSize });
  },

  async getConversation(id) {
    return apiCall(
      supabase
        .from('conversations')
        .select(CONVERSATION_SELECT_FIELDS)
        .eq('id', id)
        .maybeSingle()
    );
  },

  async createConversation(payload) {
    const parsed = parse(conversationCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('conversations')
        .insert([parsed.data])
        .select(CONVERSATION_SELECT_FIELDS)
        .single()
    );
  },

  async getParticipants(conversationId) {
    return apiCall(
      supabase
        .from('conversation_participants')
        .select(CONVERSATION_PARTICIPANT_SELECT_FIELDS)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
    );
  },

  async addParticipant(payload) {
    const parsed = parse(conversationParticipantSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('conversation_participants')
        .insert([parsed.data])
        .select(CONVERSATION_PARTICIPANT_SELECT_FIELDS)
        .single()
    );
  },

  async sendMessage(payload) {
    const parsed = parse(messageCreateSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    const insertResult = await supabase
      .from('messages')
      .insert([parsed.data])
      .select(MESSAGE_SELECT_FIELDS)
      .single();

    if (!insertResult.error) {
      return { data: insertResult.data, error: null };
    }

    if (parsed.data.client_request_id && isDuplicateClientRequestIdError(insertResult.error)) {
      const existingResult = await apiCall(
        supabase
          .from('messages')
          .select(MESSAGE_SELECT_FIELDS)
          .eq('client_request_id', parsed.data.client_request_id)
          .maybeSingle()
      );

      if (existingResult.data || existingResult.error) {
        return existingResult;
      }
    }

    return { data: null, error: insertResult.error?.message || 'An unexpected error occurred' };
  },

  async getMessages(conversationId, { limit = null, page = 1, pageSize = 50 } = {}) {
    const query = supabase
      .from('messages')
      .select(MESSAGE_SELECT_FIELDS, { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    return apiPaged(query, { page, pageSize: limit ?? pageSize });
  },

  async addAttachment(payload) {
    const parsed = parse(messageAttachmentSchema, payload);
    if (parsed.error) return validationError(parsed.error);

    return apiCall(
      supabase
        .from('message_attachments')
        .insert([parsed.data])
        .select(MESSAGE_ATTACHMENT_SELECT_FIELDS)
        .single()
    );
  },

  async getAttachmentSignedUrl(attachmentId, { expiresIn = 300 } = {}) {
    const { data: attachment, error } = await apiCall(
      supabase
        .from('message_attachments')
        .select(MESSAGE_ATTACHMENT_SELECT_FIELDS)
        .eq('id', attachmentId)
        .maybeSingle()
    );

    if (error) return validationError(error);
    if (!attachment) return validationError('Message attachment not found.');

    return storageService.createSignedUrl(
      attachment.storage_bucket || STORAGE_BUCKETS.MESSAGE_ATTACHMENTS,
      attachment.storage_path,
      { expiresIn }
    );
  },

  async redactMessage(messageId, redactedBy) {
    return apiCall(
      supabase
        .from('messages')
        .update({
          redacted_at: new Date().toISOString(),
          redacted_by: redactedBy,
        })
        .eq('id', messageId)
        .select(MESSAGE_SELECT_FIELDS)
        .single()
    );
  },

  async markRead(messageId, userId) {
    return apiCall(
      supabase
        .from('message_read_receipts')
        .upsert({ message_id: messageId, user_id: userId, read_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' })
        .select(MESSAGE_READ_RECEIPT_SELECT_FIELDS)
        .single()
    );
  },

  subscribeToConversation(conversationId, callback) {
    return supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        callback
      )
      .subscribe();
  },

  /**
   * Patient-initiated conversation: creates the conversation row, registers the
   * patient as a participant, and (optionally) sends the first message — the
   * three-step flow that pages used to wire up by hand. Returns the canonical
   * `{ data: conversation, error }` envelope. Page-level callers stay in the
   * service-layer contract instead of orchestrating multi-call sequences.
   *
   * @param {{
   *   patientId: string,
   *   userId: string,
   *   subject?: string|null,
   *   body?: string|null,
   *   clientRequestId?: string,
   * }} input
   */
  async startPatientConversation({ patientId, userId, subject = null, body = null, clientRequestId } = {}) {
    if (!patientId || !userId) {
      return validationError('startPatientConversation requires both patientId and userId.');
    }

    const conversationResult = await this.createConversation({
      patient_id: patientId,
      subject: subject?.trim() || null,
      conversation_type: 'patient_staff',
      created_by: userId,
    });
    if (conversationResult.error || !conversationResult.data) {
      return conversationResult;
    }
    const conversation = conversationResult.data;

    // Participant + first message can race — they only depend on conversation.id.
    const trimmedBody = body?.trim();
    const followUps = [
      this.addParticipant({
        conversation_id: conversation.id,
        user_id: userId,
        patient_id: patientId,
        role: 'patient',
      }),
    ];
    if (trimmedBody) {
      followUps.push(this.sendMessage({
        conversation_id: conversation.id,
        sender_user_id: userId,
        sender_patient_id: patientId,
        body: trimmedBody,
        message_type: 'text',
        is_internal: false,
        client_request_id: clientRequestId ?? crypto.randomUUID(),
      }));
    }

    const settled = await Promise.all(followUps);
    const firstError = settled.find((r) => r?.error)?.error;
    if (firstError) {
      // Surface the failure but return the conversation so the caller can
      // recover (e.g. retry the send) rather than silently losing context.
      return { data: conversation, error: firstError };
    }
    return { data: conversation, error: null };
  },
};
