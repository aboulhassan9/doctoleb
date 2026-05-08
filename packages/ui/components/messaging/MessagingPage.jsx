/**
 * MessagingPage — Shared inbox + thread view for patient and staff messaging.
 *
 * Used by patient-web (mode="patient") and clinic-ops (mode="staff").
 *
 * Idempotency: sendMessage carries a `client_request_id` so retries collapse.
 * Realtime: subscribeToConversation watches `messages` for the active row;
 *   new messages append without refresh, and de-duplicate against the
 *   optimistic local row by `client_request_id`.
 * Redaction: per CLAUDE.md the scrub trigger overwrites `body` to `[redacted]`;
 *   the UI also renders italicized "[redacted]" when `redacted_at` is set
 *   (defense in depth).
 *
 * @see docs/decisions/ADR-002 — frontend app split
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { messagingService } from '@/services/messaging';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { logError } from '@/lib/logger';
import { smartTimestamp } from '@/lib/dateUtils';
import { getUserDisplayName, getUserInitials } from '@/lib/userDisplay';
import { Modal, EmptyState } from '@ui/components/ui';

export const MESSAGING_MODES = Object.freeze({ patient: 'patient', staff: 'staff' });

function getPatientName(patient) {
  return getUserDisplayName(patient, 'Patient');
}

function getConversationTitle(conv, isPatient) {
  if (conv.subject?.trim()) return conv.subject.trim();
  return isPatient ? 'Conversation with the clinic' : getPatientName(conv.patients);
}

/**
 * @param {{ mode: 'patient'|'staff', className?: string }} props
 */
export function MessagingPage({ mode, className = '' }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  const scrollerRef = useRef(null);
  const userId = user?.id ?? null;
  const patientId = user?.patient_id ?? null;
  const isPatient = mode === MESSAGING_MODES.patient;

  // ── Conversations list (effect-only; no useCallback so the deps don't churn).

  useEffect(() => {
    let cancelled = false;
    setLoadingConversations(true);
    (async () => {
      try {
        const filter = isPatient && patientId ? { patientId } : {};
        const { data, error } = await messagingService.getConversations({ ...filter, pageSize: 50 });
        if (cancelled) return;
        if (error) {
          showToast(error, 'error');
          setConversations([]);
          return;
        }
        setConversations(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        logError('MessagingPage:loadConversations', err);
        showToast('Failed to load conversations', 'error');
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPatient, patientId, showToast]);

  // Auto-select the most recent conversation once the list arrives. Separate
  // effect so the conversations fetch doesn't re-fire when the user clicks
  // a different conversation.
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  // ── Messages for active conversation.

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      try {
        const { data, error } = await messagingService.getMessages(activeConversationId, { pageSize: 100 });
        if (cancelled) return;
        if (error) {
          showToast(error, 'error');
          setMessages([]);
          return;
        }
        // Service orders DESC; reverse for top-down chronological display.
        setMessages(Array.isArray(data) ? [...data].reverse() : []);
      } catch (err) {
        if (cancelled) return;
        logError('MessagingPage:loadMessages', err);
        showToast('Failed to load messages', 'error');
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, showToast]);

  // ── Realtime subscription.

  useEffect(() => {
    if (!activeConversationId) return undefined;
    const subscription = messagingService.subscribeToConversation(activeConversationId, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          if (payload.new.client_request_id && prev.some((m) => m.client_request_id === payload.new.client_request_id)) {
            return prev.map((m) =>
              m.client_request_id === payload.new.client_request_id ? { ...m, ...payload.new } : m
            );
          }
          return [...prev, payload.new];
        });
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      }
    });
    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch (err) {
        logError('MessagingPage:unsubscribe', err);
      }
    };
  }, [activeConversationId]);

  // ── Auto-scroll to latest message on new content.

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, activeConversationId]);

  // ── Send message.

  const handleSend = useCallback(async () => {
    const body = composeBody.trim();
    if (!body || sending || !activeConversationId) return;
    if (!userId && !patientId) {
      showToast('Cannot determine sender identity', 'error');
      return;
    }

    const clientRequestId = crypto.randomUUID();
    const optimisticMessage = {
      id: `optimistic-${clientRequestId}`,
      conversation_id: activeConversationId,
      sender_user_id: userId,
      sender_patient_id: isPatient ? patientId : null,
      body,
      message_type: 'text',
      is_internal: false,
      redacted_at: null,
      client_request_id: clientRequestId,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setComposeBody('');
    setSending(true);

    try {
      const { data, error } = await messagingService.sendMessage({
        conversation_id: activeConversationId,
        sender_user_id: userId,
        sender_patient_id: isPatient ? patientId : null,
        body,
        message_type: 'text',
        is_internal: false,
        client_request_id: clientRequestId,
      });

      if (error) {
        showToast(error, 'error');
        setMessages((prev) => prev.filter((m) => m.client_request_id !== clientRequestId));
        setComposeBody(body);
        return;
      }

      setMessages((prev) => prev.map((m) => (m.client_request_id === clientRequestId ? data : m)));
    } catch (err) {
      logError('MessagingPage:send', err);
      showToast('Failed to send message', 'error');
      setMessages((prev) => prev.filter((m) => m.client_request_id !== clientRequestId));
      setComposeBody(body);
    } finally {
      setSending(false);
    }
  }, [composeBody, sending, activeConversationId, userId, patientId, isPatient, showToast]);

  const handleComposeKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  // ── New conversation (patient-only). Service handles the multi-step flow.

  const handleCreateConversation = useCallback(async ({ subject, body }) => {
    if (!isPatient || !patientId || !userId) {
      showToast('Cannot start a conversation without a patient identity', 'error');
      return;
    }
    const { data: conversation, error } = await messagingService.startPatientConversation({
      patientId,
      userId,
      subject,
      body,
    });
    if (error && !conversation) {
      showToast(error, 'error');
      return;
    }
    if (error) {
      // Conversation exists but follow-ups failed — surface the warning,
      // still navigate the user into it so they can retry.
      showToast(error, 'error');
    }
    setShowNewConversationModal(false);
    setActiveConversationId(conversation.id);
    setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));
  }, [isPatient, patientId, userId, showToast]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  return (
    <div className={`flex h-full min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}>
      {/* Left rail: conversations */}
      <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">Conversations</h2>
          {isPatient && (
            <button
              onClick={() => setShowNewConversationModal(true)}
              className="text-xs font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-all"
            >
              + New
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-slate-400 text-sm">Loading…</div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon="forum"
              title="No conversations yet"
              subtitle={isPatient ? 'Start one to message the clinic team.' : 'Patient messages will appear here.'}
              action={isPatient ? (
                <button
                  onClick={() => setShowNewConversationModal(true)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Start a new conversation
                </button>
              ) : null}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeConversationId}
                  isPatient={isPatient}
                  onSelect={() => setActiveConversationId(conv.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right pane: thread */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeConversation ? (
          <>
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{getConversationTitle(activeConversation, isPatient)}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeConversation.conversation_type === 'support' ? 'Support' : 'Clinical messaging'}
                {activeConversation.status === 'closed' ? ' · Closed' : ''}
              </p>
            </div>

            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMessages ? (
                <p className="text-center text-slate-400 text-sm">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm">No messages yet. Say hello.</p>
              ) : (
                messages.map((m) => (
                  <MessageBubble key={m.id} message={m} currentUserId={userId} currentPatientId={patientId} />
                ))
              )}
            </div>

            {activeConversation.status !== 'closed' && (
              <div className="border-t border-slate-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    onKeyDown={handleComposeKeyDown}
                    placeholder="Type a message…  (Enter to send, Shift+Enter for newline)"
                    rows={2}
                    maxLength={8000}
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !composeBody.trim()}
                    className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            {loadingConversations ? 'Loading…' : 'Select a conversation to view messages.'}
          </div>
        )}
      </div>

      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onSubmit={handleCreateConversation}
      />
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function ConversationRow({ conv, isActive, isPatient, onSelect }) {
  const patientName = getPatientName(conv.patients);
  const subject = conv.subject?.trim();
  const title = subject || (isPatient ? 'Conversation' : patientName);
  const sub = isPatient
    ? (conv.conversation_type === 'support' ? 'Support' : 'Clinic team')
    : (subject ? patientName : '');

  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full text-left px-4 py-3 transition-colors ${
          isActive ? 'bg-primary/10' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`font-semibold text-sm truncate ${isActive ? 'text-primary' : 'text-slate-900'}`}>
              {title}
            </p>
            {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
          </div>
          {conv.status === 'closed' && (
            <span className="text-[10px] font-bold uppercase text-slate-400">Closed</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{smartTimestamp(conv.updated_at || conv.created_at)}</p>
      </button>
    </li>
  );
}

function MessageBubble({ message, currentUserId, currentPatientId }) {
  const isMine = (message.sender_user_id && message.sender_user_id === currentUserId) ||
                 (message.sender_patient_id && message.sender_patient_id === currentPatientId);
  const isRedacted = Boolean(message.redacted_at);
  const isSystem = message.message_type === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          {isRedacted ? '[redacted]' : message.body}
        </span>
      </div>
    );
  }

  const senderUser = message.users || null;
  const senderName = senderUser ? getUserDisplayName(senderUser) : null;
  const senderInitials = senderUser ? getUserInitials(senderUser) : null;

  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
        isMine ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
      }`}>
        {senderInitials || (isMine ? 'You' : '?')}
      </div>
      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && senderName && (
          <p className="text-[11px] text-slate-500 mb-0.5 px-1">{senderName}</p>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm ${
            isRedacted
              ? 'bg-slate-100 text-slate-400 italic'
              : isMine
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-slate-100 text-slate-900 rounded-bl-sm'
          } ${message._optimistic ? 'opacity-70' : ''}`}
        >
          {isRedacted ? '[redacted]' : message.body}
        </div>
        <p className={`text-[10px] text-slate-400 mt-1 px-1 ${isMine ? 'text-right' : ''}`}>
          {smartTimestamp(message.created_at)}
          {message._optimistic ? ' · sending…' : ''}
        </p>
      </div>
    </div>
  );
}

function NewConversationModal({ isOpen, onClose, onSubmit }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = body.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ subject: subject.trim() || null, body: body.trim() });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New conversation" size="lg">
      <p className="text-xs text-slate-500 mb-4 -mt-2">The clinic team will respond as soon as they can.</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Subject (optional)</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={240}
            placeholder="e.g. Question about my prescription"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
            rows={5}
            placeholder="Write your first message…"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all"
        >
          {submitting ? 'Starting…' : 'Start conversation'}
        </button>
      </div>
    </Modal>
  );
}
