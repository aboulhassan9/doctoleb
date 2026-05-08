import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildSessionUser } from '../../packages/core/lib/authIdentity.js';

class FakeSupabaseQuery {
  constructor(table, state) {
    this.table = table;
    this.state = state;
    this.filters = {};
    this.selectedFields = null;
    this.orderBy = null;
    this.limitCount = null;
  }

  select(fields) {
    this.selectedFields = fields;
    return this;
  }

  eq(column, value) {
    this.filters[column] = value;
    return this;
  }

  order(column, options) {
    this.orderBy = { column, options };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.state.calls.push({
      table: this.table,
      filters: { ...this.filters },
      orderBy: this.orderBy,
      limitCount: this.limitCount,
    });

    if (this.state.errors[this.table]) {
      return { data: null, error: this.state.errors[this.table] };
    }

    const row = this.findRow();
    return { data: this.project(row), error: null };
  }

  findRow() {
    const rows = this.state.rows[this.table] || [];
    const matchesFilters = (row) => Object
      .entries(this.filters)
      .every(([column, value]) => row[column] === value);

    const candidates = rows.filter(matchesFilters);
    if (this.orderBy?.column) {
      candidates.sort((left, right) => String(left[this.orderBy.column]).localeCompare(String(right[this.orderBy.column])));
    }

    return candidates[0] || null;
  }

  project(row) {
    if (!row || !this.selectedFields) return row;

    return Object.fromEntries(
      this.selectedFields
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
        .map((field) => [field, row[field]]),
    );
  }
}

function createSupabaseFake({ patients = [], doctors = [], staffMembers = [], errors = {} } = {}) {
  const state = {
    calls: [],
    errors,
    rows: {
      patients,
      doctors,
      staff_members: staffMembers,
    },
  };

  return {
    calls: state.calls,
    from(table) {
      return new FakeSupabaseQuery(table, state);
    },
  };
}

describe('buildSessionUser', () => {
  it('fails closed for staff users without an active staff assignment', async () => {
    const supabase = createSupabaseFake({
      doctors: [
        {
          id: 'doctor-one',
          user_id: 'doctor-user',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const result = await buildSessionUser(supabase, {
      id: 'staff-user',
      role: 'secretary',
      email: 'secretary@example.test',
    });

    assert.equal(result.data, null);
    assert.equal(result.error, 'Active staff assignment not found for this account.');
    assert.deepEqual(
      supabase.calls.map((call) => call.table),
      ['staff_members'],
    );
  });

  it('uses the active staff assignment doctor for clinic staff users', async () => {
    const supabase = createSupabaseFake({
      staffMembers: [
        {
          user_id: 'staff-user',
          doctor_id: 'doctor-assigned',
          is_active: true,
        },
      ],
    });

    const result = await buildSessionUser(supabase, {
      id: 'staff-user',
      role: 'predoctor',
      email: 'predoctor@example.test',
    });

    assert.equal(result.error, null);
    assert.equal(result.data.doctor_id, 'doctor-assigned');
    assert.equal(result.data.patient_id, null);
  });

  it('keeps doctor identity scoped to the linked doctor record', async () => {
    const supabase = createSupabaseFake({
      doctors: [
        {
          id: 'doctor-one',
          user_id: 'doctor-user',
        },
      ],
    });

    const result = await buildSessionUser(supabase, {
      id: 'doctor-user',
      role: 'doctor',
      email: 'doctor@example.test',
    });

    assert.equal(result.error, null);
    assert.equal(result.data.doctor_id, 'doctor-one');
    assert.equal(result.data.patient_id, null);
  });
});
