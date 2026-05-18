import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupPatientTimelineItems,
  normalizePatientTimelineDocuments,
} from '../../../packages/core/schemas/index.js';

describe('patient timeline helpers', () => {
  it('hides draft or voided documents and groups finalized records by day', () => {
    const items = normalizePatientTimelineDocuments([
      {
        id: '1',
        document_type: 'lab_result',
        title: 'Lab result',
        status: 'final',
        created_at: '2026-05-18T08:00:00Z',
      },
      {
        id: '2',
        document_type: 'report',
        title: 'Draft report',
        status: 'draft',
        created_at: '2026-05-18T09:00:00Z',
      },
    ]);

    const groups = groupPatientTimelineItems(items);

    assert.equal(items.length, 1);
    assert.equal(items[0].label, 'Lab result');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, '2026-05-18');
  });
});
