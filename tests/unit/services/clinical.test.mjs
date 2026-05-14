import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { clinicalService } from '../../../packages/core/services/clinical.js';

// UUIDs for fixtures — F3 schemas in this service require real uuid format.
const ENCOUNTER_ID    = '11111111-1111-4111-8111-111111111111';
const APPOINTMENT_ID  = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID      = '33333333-3333-4333-8333-333333333333';
const DOCTOR_ID       = '44444444-4444-4444-8444-444444444444';
const AUTHOR_USER_ID  = '55555555-5555-4555-8555-555555555555';
const CARE_TASK_ID    = '66666666-6666-4666-8666-666666666666';
const RECORDED_BY     = '77777777-7777-4777-8777-777777777777';
const CREATED_BY      = '88888888-8888-4888-8888-888888888888';

const ENCOUNTER_ROW = {
  id: ENCOUNTER_ID,
  appointment_id: APPOINTMENT_ID,
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  status: 'in_progress',
  started_at: '2026-05-14T09:00:00Z',
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

describe('clinicalService.startEncounter / completeEncounter / cancelEncounter', () => {
  it('routes startEncounter to the start_encounter RPC with the correct args', async () => {
    mock.onRpc('start_encounter', () => ({ data: ENCOUNTER_ROW, error: null }));
    const result = await clinicalService.startEncounter(APPOINTMENT_ID, { chiefComplaint: 'fever' });
    assert.equal(result.error, null);
    const rpcCall = mock.calls.rpc.find((c) => c.name === 'start_encounter');
    assert.ok(rpcCall);
    assert.equal(rpcCall.args.p_appointment, APPOINTMENT_ID);
    assert.equal(rpcCall.args.p_chief_complaint, 'fever');
  });

  it('routes completeEncounter to complete_encounter and propagates the summary', async () => {
    mock.onRpc('complete_encounter', () => ({ data: { id: ENCOUNTER_ID }, error: null }));
    const result = await clinicalService.completeEncounter(ENCOUNTER_ID, { summary: 'Resolved' });
    assert.equal(result.error, null);
    const rpcCall = mock.calls.rpc.find((c) => c.name === 'complete_encounter');
    assert.equal(rpcCall.args.p_encounter, ENCOUNTER_ID);
    assert.equal(rpcCall.args.p_summary, 'Resolved');
  });

  it('routes cancelEncounter to cancel_encounter and propagates the reason', async () => {
    mock.onRpc('cancel_encounter', () => ({ data: { id: ENCOUNTER_ID }, error: null }));
    const result = await clinicalService.cancelEncounter(ENCOUNTER_ID, { reason: 'Patient left' });
    assert.equal(result.error, null);
    const rpcCall = mock.calls.rpc.find((c) => c.name === 'cancel_encounter');
    assert.equal(rpcCall.args.p_reason, 'Patient left');
  });
});

describe('clinicalService.createEncounter', () => {
  it('validates the payload before calling the RPC', async () => {
    const result = await clinicalService.createEncounter({ appointment_id: 'not-a-uuid' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.rpc.length, 0);
  });

  it('forwards to start_encounter on a valid payload', async () => {
    mock.onRpc('start_encounter', () => ({ data: ENCOUNTER_ROW, error: null }));
    const result = await clinicalService.createEncounter({
      appointment_id: APPOINTMENT_ID,
      chief_complaint: 'cough',
    });
    assert.equal(result.error, null);
    const rpcCall = mock.calls.rpc.find((c) => c.name === 'start_encounter');
    assert.ok(rpcCall);
    assert.equal(rpcCall.args.p_appointment, APPOINTMENT_ID);
  });
});

describe('clinicalService.updateEncounter — status-mutation guard', () => {
  it('rejects payloads that try to set status directly', async () => {
    const result = await clinicalService.updateEncounter(ENCOUNTER_ID, { status: 'completed' });
    assert.equal(result.data, null);
    assert.match(String(result.error), /lifecycle methods/i);
    // No update should have been attempted.
    const updateCalls = mock.calls.from.filter((c) => c.modifiers.some((m) => m.method === 'update'));
    assert.equal(updateCalls.length, 0);
  });

  it('allows updates to non-status fields (e.g. chief_complaint)', async () => {
    mock.onFrom('encounters', () => ({ data: { ...ENCOUNTER_ROW, chief_complaint: 'cough x 3 days' }, error: null }));
    const result = await clinicalService.updateEncounter(ENCOUNTER_ID, { chief_complaint: 'cough x 3 days' });
    assert.equal(result.error, null);
    assert.equal(result.data.chief_complaint, 'cough x 3 days');
  });
});

describe('clinicalService.addNote', () => {
  it('rejects an empty content body before any insert', async () => {
    const result = await clinicalService.addNote({
      encounter_id: ENCOUNTER_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_ID,
      author_user_id: AUTHOR_USER_ID,
      content: '',
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('inserts a valid note and returns the new row', async () => {
    const noteRow = { id: 'note-1', encounter_id: ENCOUNTER_ID, content: 'Patient stable.' };
    mock.onFrom('clinical_notes', () => ({ data: noteRow, error: null }));
    const result = await clinicalService.addNote({
      encounter_id: ENCOUNTER_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_ID,
      author_user_id: AUTHOR_USER_ID,
      content: 'Patient stable.',
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, 'note-1');
  });
});

describe('clinicalService.addDiagnosis', () => {
  it('rejects a payload with neither disease_id nor diagnosis_text', async () => {
    const result = await clinicalService.addDiagnosis({
      encounter_id: ENCOUNTER_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_ID,
      recorded_by: RECORDED_BY,
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('inserts a valid diagnosis with diagnosis_text', async () => {
    const diagRow = { id: 'diag-1', encounter_id: ENCOUNTER_ID, diagnosis_text: 'Acute pharyngitis' };
    mock.onFrom('diagnoses', () => ({ data: diagRow, error: null }));
    const result = await clinicalService.addDiagnosis({
      encounter_id: ENCOUNTER_ID,
      patient_id: PATIENT_ID,
      doctor_id: DOCTOR_ID,
      recorded_by: RECORDED_BY,
      diagnosis_text: 'Acute pharyngitis',
    });
    assert.equal(result.error, null);
    assert.equal(result.data.diagnosis_text, 'Acute pharyngitis');
  });
});

describe('clinicalService.addPrescription', () => {
  it('rejects an invalid prescription payload before insert', async () => {
    const result = await clinicalService.addPrescription({});
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });
});

describe('clinicalService.createCareTask + transitionCareTask', () => {
  it('rejects a care task with an empty title', async () => {
    const result = await clinicalService.createCareTask({
      created_by: CREATED_BY,
      title: '',
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('inserts a valid care task and returns the new row', async () => {
    const row = { id: CARE_TASK_ID, status: 'open', title: 'Call patient about results' };
    mock.onFrom('care_tasks', () => ({ data: row, error: null }));
    const result = await clinicalService.createCareTask({
      created_by: CREATED_BY,
      patient_id: PATIENT_ID,
      title: 'Call patient about results',
    });
    assert.equal(result.error, null);
    assert.equal(result.data.id, CARE_TASK_ID);
  });

  it('transitionCareTask rejects an invalid transition (open → cancelled is allowed, done → open is not)', async () => {
    // First call (getCareTaskById) returns current with status 'done'.
    let getCallCount = 0;
    mock.onFrom('care_tasks', () => {
      getCallCount += 1;
      return { data: { id: CARE_TASK_ID, status: 'done' }, error: null };
    });
    const result = await clinicalService.transitionCareTask(CARE_TASK_ID, 'open');
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    // First read happened; no second update call should have followed.
    assert.equal(getCallCount, 1);
  });

  it('transitionCareTask succeeds on a valid transition (open → in_progress)', async () => {
    let callIndex = 0;
    mock.onFrom('care_tasks', () => {
      callIndex += 1;
      if (callIndex === 1) return { data: { id: CARE_TASK_ID, status: 'open' }, error: null };
      return { data: { id: CARE_TASK_ID, status: 'in_progress' }, error: null };
    });
    const result = await clinicalService.transitionCareTask(CARE_TASK_ID, 'in_progress');
    assert.equal(result.error, null);
    assert.equal(result.data.status, 'in_progress');
  });
});
