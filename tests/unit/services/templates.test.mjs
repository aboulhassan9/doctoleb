import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
import { templateService } from '../../../packages/core/services/templates.js';

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_BY  = '22222222-2222-4222-8222-222222222222';
const ARCHIVED_BY = '33333333-3333-4333-8333-333333333333';

const VALID_SECTION = {
  key: 'patient_info',
  title: 'Patient Information',
  fields: [
    { key: 'full_name', label: 'Full Name', type: 'text', autofill: 'patient.full_name' },
    { key: 'dob', label: 'Date of Birth', type: 'date', autofill: 'patient.date_of_birth' },
  ],
};

const VALID_CREATE_PAYLOAD = {
  name: 'Medical Referral Letter',
  template_type: 'referral',
  description: 'Standard referral letter',
  sections: [VALID_SECTION],
  created_by: CREATED_BY,
};

const TEMPLATE_ROW = {
  id: TEMPLATE_ID,
  name: 'Medical Referral Letter',
  template_type: 'referral',
  description: 'Standard referral letter',
  sections: [VALID_SECTION],
  is_default: false,
  created_by: CREATED_BY,
  is_archived: false,
  archived_at: null,
  archived_by: null,
  created_at: '2026-05-15T09:00:00Z',
  updated_at: '2026-05-15T09:00:00Z',
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

// --- AT-2.1: templateService.create rejects empty sections ---
describe('templateService.create — input validation (AT-2.1)', () => {
  it('rejects an empty sections array', async () => {
    const result = await templateService.create({
      ...VALID_CREATE_PAYLOAD,
      sections: [],
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    // No DB call should have been made.
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a missing name', async () => {
    const { name: _omit, ...noName } = VALID_CREATE_PAYLOAD;
    const result = await templateService.create(noName);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a missing created_by', async () => {
    const { created_by: _omit, ...noCreator } = VALID_CREATE_PAYLOAD;
    const result = await templateService.create(noCreator);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects an invalid template_type', async () => {
    const result = await templateService.create({
      ...VALID_CREATE_PAYLOAD,
      template_type: 'invoice',
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a section with zero fields', async () => {
    const result = await templateService.create({
      ...VALID_CREATE_PAYLOAD,
      sections: [{ key: 'empty', title: 'Empty Section', fields: [] }],
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('rejects a select field without options', async () => {
    const result = await templateService.create({
      ...VALID_CREATE_PAYLOAD,
      sections: [{
        key: 'test',
        title: 'Test',
        fields: [{ key: 'gender', label: 'Gender', type: 'select' }],
      }],
    });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });
});

describe('templateService.create — happy path', () => {
  it('inserts a valid template and returns the row', async () => {
    mock.onFrom('document_templates', () => ({ data: TEMPLATE_ROW, error: null }));
    const result = await templateService.create(VALID_CREATE_PAYLOAD);
    assert.equal(result.error, null);
    assert.equal(result.data.id, TEMPLATE_ID);
    assert.equal(result.data.template_type, 'referral');
    // Verify one call to document_templates with an insert modifier.
    const calls = mock.calls.from.filter((c) => c.table === 'document_templates');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].modifiers.some((m) => m.method === 'insert'));
  });
});

describe('templateService.getAll', () => {
  it('queries document_templates with the correct table and filters', async () => {
    mock.onFrom('document_templates', () => ({ data: [TEMPLATE_ROW], error: null, count: 1 }));
    const result = await templateService.getAll({ templateType: 'referral' });
    assert.equal(result.error, null);
    assert.equal(result.data.length, 1);
    const calls = mock.calls.from.filter((c) => c.table === 'document_templates');
    assert.equal(calls.length, 1);
    // Should have eq modifiers for template_type and is_archived.
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'template_type'));
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'is_archived'));
  });

  it('includes archived when requested', async () => {
    mock.onFrom('document_templates', () => ({ data: [], error: null, count: 0 }));
    await templateService.getAll({ includeArchived: true });
    const calls = mock.calls.from.filter((c) => c.table === 'document_templates');
    // Should NOT have an is_archived filter.
    assert.ok(!calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'is_archived'));
  });
});

describe('templateService.getById', () => {
  it('rejects a missing ID', async () => {
    const result = await templateService.getById(null);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('fetches by ID with single()', async () => {
    mock.onFrom('document_templates', () => ({ data: TEMPLATE_ROW, error: null }));
    const result = await templateService.getById(TEMPLATE_ID);
    assert.equal(result.error, null);
    assert.equal(result.data.id, TEMPLATE_ID);
    const calls = mock.calls.from.filter((c) => c.table === 'document_templates');
    assert.equal(calls.length, 1);
    assert.ok(calls[0].modifiers.some((m) => m.method === 'eq' && m.args[0] === 'id'));
  });
});

describe('templateService.update', () => {
  it('rejects a missing ID', async () => {
    const result = await templateService.update(null, { name: 'New Name' });
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
    assert.equal(mock.calls.from.length, 0);
  });

  it('updates a valid payload', async () => {
    const updated = { ...TEMPLATE_ROW, name: 'Updated Name' };
    mock.onFrom('document_templates', () => ({ data: updated, error: null }));
    const result = await templateService.update(TEMPLATE_ID, { name: 'Updated Name' });
    assert.equal(result.error, null);
    assert.equal(result.data.name, 'Updated Name');
  });
});

describe('templateService.archive', () => {
  it('rejects a missing ID', async () => {
    const result = await templateService.archive(null, ARCHIVED_BY);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('rejects a missing archivedBy', async () => {
    const result = await templateService.archive(TEMPLATE_ID, null);
    assert.equal(result.data, null);
    assert.notEqual(result.error, null);
  });

  it('archives a template', async () => {
    const archived = { ...TEMPLATE_ROW, is_archived: true, archived_by: ARCHIVED_BY };
    mock.onFrom('document_templates', () => ({ data: archived, error: null }));
    const result = await templateService.archive(TEMPLATE_ID, ARCHIVED_BY);
    assert.equal(result.error, null);
    assert.equal(result.data.is_archived, true);
  });
});

describe('templateService.coerceDocumentType', () => {
  it('maps referral → referral', () => {
    assert.equal(templateService.coerceDocumentType('referral'), 'referral');
  });

  it('maps custom → other (OQ-3 resolution)', () => {
    assert.equal(templateService.coerceDocumentType('custom'), 'other');
  });

  it('maps unknown → other', () => {
    assert.equal(templateService.coerceDocumentType('unknown_type'), 'other');
  });
});
