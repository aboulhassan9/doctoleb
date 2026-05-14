import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { messagingService } from '../../../packages/core/services/messaging.js';

const CONVERSATION_ID  = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID       = '22222222-2222-4222-8222-222222222222';
const SENDER_USER_ID   = '33333333-3333-4333-8333-333333333333';
const SENDER_PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const MESSAGE_ID       = '55555555-5555-4555-8555-555555555555';
const CLIENT_REQUEST_ID = '66666666-6666-4666-8666-666666666666';
const REDACTED_BY      = '77777777-7777-4777-8777-777777777777';

const VALID_MESSAGE = {
  conversation_id: CONVERSATION_ID,
  sender_user_id: SENDER_USER_ID,
  body: 'Hello, this is a test message.',
};

const MESSAGE_ROW = {
  id: MESSAGE_ID,
  conversation_id: CONVERSATION_ID,
  sender_user_id: SENDER_USER_ID,
  body: 'Hello, this is a test message.',
  created_at: '2026-05-14T09:00:00Z',
};

let mock;
let previousClient;

beforeEach(() => {
  mock = createSupabaseMock();
  previousClient = __setSupabaseClientForTest(mock.client);
});

afterEach(() => {
  __setSupabaseClientForTest(previousClient);
});

describe('messagingService.sendMessage — input validation', () => {
  it('rejects an empty body before any insert', async () => {
    const result = await messagingService.sendMessage({ ...VALID_MESSAGE, body: '' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a payload missing both sender fields (the .refine guard)', async () => {
    const { sender_user_id: _omit, ...partial } = VALID_MESSAGE;
    const result = await messagingService.sendMessage(partial);
    assert.equal(result.data, null);
    assert.match(String(result.error), /sender/i);
    assert.equal(mock.calls.from.length, 0);
  });

  it('accepts a message from a patient (sender_patient_id instead of sender_user_id)', async () => {
    mock.onFrom('messages', () => ({ data: MESSAGE_ROW, error: null }));
    const result = await messagingService.sendMessage({
      conversation_id: CONVERSATION_ID,
      sender_patient_id: SENDER_PATIENT_ID,
      body: 'Hello from the patient.',
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, MESSAGE_ID);
  });
});

describe('messagingService.sendMessage — idempotency (the headline contract)', () => {
  it('returns the inserted row on a clean first call', async () => {
    mock.onFrom('messages', () => ({ data: MESSAGE_ROW, error: null }));
    const result = await messagingService.sendMessage({
      ...VALID_MESSAGE,
      client_request_id: CLIENT_REQUEST_ID,
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, MESSAGE_ID);
    // Exactly one messages-table call: the insert.
    const messageCalls = mock.calls.from.filter((c) => c.table === 'messages');
    assert.equal(messageCalls.length, 1);
    assert.ok(messageCalls[0].modifiers.some((m) => m.method === 'insert'));
  });

  it('on a duplicate client_request_id, fetches the existing row instead of failing', async () => {
    let callIndex = 0;
    mock.onFrom('messages', ({ callEntry }) => {
      callIndex += 1;
      // First call is the insert — fail it with the Postgres unique-violation code.
      if (callEntry.modifiers.some((m) => m.method === 'insert')) {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_messages_client_request_id_unique"' },
        };
      }
      // Second call is the lookup-by-client-request-id — return the existing row.
      return { data: MESSAGE_ROW, error: null };
    });

    const result = await messagingService.sendMessage({
      ...VALID_MESSAGE,
      client_request_id: CLIENT_REQUEST_ID,
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, MESSAGE_ID);
    // Two calls: insert (failed), then select-by-client_request_id (succeeded).
    assert.equal(callIndex, 2);
    const calls = mock.calls.from.filter((c) => c.table === 'messages');
    assert.equal(calls.length, 2);
    assert.ok(calls[0].modifiers.some((m) => m.method === 'insert'));
    assert.ok(calls[1].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'client_request_id'));
  });

  it('on a non-23505 error, surfaces the error and does NOT issue the lookup', async () => {
    mock.onFrom('messages', () => ({
      data: null,
      error: { code: '23502', message: 'null value in column "body" violates not-null constraint' },
    }));
    const result = await messagingService.sendMessage({
      ...VALID_MESSAGE,
      client_request_id: CLIENT_REQUEST_ID,
    });
    assert.equal(result.data, null);
    assert.match(String(result.error), /null value in column/);
    // Only one call — no recovery lookup for a generic error.
    assert.equal(mock.calls.from.filter((c) => c.table === 'messages').length, 1);
  });

  it('without client_request_id, a 23505 still surfaces as an error (no lookup is possible)', async () => {
    mock.onFrom('messages', () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    }));
    const result = await messagingService.sendMessage(VALID_MESSAGE); // no client_request_id
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    // Only the failed insert was attempted.
    assert.equal(mock.calls.from.filter((c) => c.table === 'messages').length, 1);
  });
});

describe('messagingService.createConversation', () => {
  it('rejects an invalid payload (non-UUID created_by)', async () => {
    const result = await messagingService.createConversation({ created_by: 'not-a-uuid' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('inserts a valid conversation and returns the new row', async () => {
    const row = { id: CONVERSATION_ID, patient_id: PATIENT_ID, conversation_type: 'patient_staff' };
    mock.onFrom('conversations', () => ({ data: row, error: null }));
    const result = await messagingService.createConversation({
      patient_id: PATIENT_ID,
      subject: 'Follow-up on lab results',
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, CONVERSATION_ID);
  });
});

describe('messagingService.redactMessage', () => {
  it('updates redacted_at + redacted_by and returns the row', async () => {
    const redactedRow = { id: MESSAGE_ID, redacted_at: '2026-05-14T10:00:00Z', redacted_by: REDACTED_BY };
    let capturedUpdate = null;
    mock.onFrom('messages', ({ callEntry }) => {
      const updateMod = callEntry.modifiers.find((m) => m.method === 'update');
      if (updateMod) capturedUpdate = updateMod.args[0];
      return { data: redactedRow, error: null };
    });

    const result = await messagingService.redactMessage(MESSAGE_ID, REDACTED_BY);
    assert.equal(result.error, null);
    assert.equal(result.data.id, MESSAGE_ID);
    assert.ok(capturedUpdate);
    assert.equal(capturedUpdate.redacted_by, REDACTED_BY);
    // The redacted_at should be an ISO timestamp string.
    assert.match(String(capturedUpdate.redacted_at), /^\d{4}-\d{2}-\d{2}T/);
  });
});
