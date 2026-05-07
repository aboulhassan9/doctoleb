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
  parseWithSchema,
} from '@/schemas';
import { apiCall, apiPaged } from './api';
import { STORAGE_BUCKETS, storageService } from './storage';

function validationError(error) {
  return { data: null, error };
}

function parse(schema, payload) {
  const result = parseWithSchema(schema, payload);
  if (result.error) {
    return { error: result.error };
  }
  return { data: result.data };
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

    return apiCall(
      supabase
        .from('messages')
        .insert([parsed.data])
        .select(MESSAGE_SELECT_FIELDS)
        .single()
    );
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
};
