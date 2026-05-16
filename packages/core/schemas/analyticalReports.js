/**
 * analyticalReports.js — Schema for the doctor-built analytical report engine.
 *
 * Design principles:
 *   - Doctors / admins / staff build saved reports by composing closed-set
 *     primitives: a data source, columns to group by, columns to aggregate,
 *     optional filters, and a visualization choice. Never raw SQL.
 *   - Every identifier in the definition (data source, column name,
 *     aggregation function, viz type, operator) is validated against an
 *     allowlist. The JS service compiles the definition to a query — there
 *     is no SQL-injection surface because the source strings never reach
 *     `format()` or string concatenation; they're used to BUILD a typed
 *     supabase-js chain or call a closed RPC.
 *   - RLS does the row-level security. The compiler enforces SECURITY
 *     INVOKER semantics. A doctor running "completed appointments by
 *     doctor" sees only the rows their RLS allows them to see.
 *   - Pharmacy / lab / external data sources are added by extending the
 *     allowlists in this file — never by adding a new "raw_sql" escape.
 */

import { z } from 'zod';

// ── Data sources ─────────────────────────────────────────────────────

/**
 * Closed set of report data sources. Each source maps to a real table /
 * view that the JS compiler knows how to query. Adding a new source means:
 *   1. Add it to DATA_SOURCES.
 *   2. Add its column allowlist to DATA_SOURCE_COLUMNS.
 *   3. Add its default filter (e.g. `is_archived = false`) to
 *      DATA_SOURCE_DEFAULT_FILTERS.
 *   4. Implement the compiler branch in
 *      `packages/core/services/analyticalReports.js`.
 *
 * Future pharmacy / lab integrations land here as new sources — the
 * compiler stays closed-set.
 */
export const REPORT_DATA_SOURCES = Object.freeze([
  'appointments',
  'encounters',
  'diagnoses',
  'prescriptions',
  'lab_orders',
  'imaging_orders',
  'payments',
  'patients',
  'care_tasks',
  'medical_intake',
]);

/**
 * Allowed columns per data source. The compiler will reject any column not
 * in this list, both for group_by, aggregations, filters, and order_by.
 * Columns that would expose PHI inappropriately (e.g. patients.allergies)
 * are intentionally OMITTED — a doctor cannot pivot reports on free-text
 * clinical content. They can pivot on enums, timestamps, FKs, and amounts.
 */
export const REPORT_DATA_SOURCE_COLUMNS = Object.freeze({
  appointments: [
    'id', 'doctor_id', 'patient_id', 'clinic_id', 'visit_type_id',
    'scheduled_at', 'duration_minutes', 'status', 'booked_by',
    'created_at', 'updated_at',
  ],
  encounters: [
    'id', 'appointment_id', 'patient_id', 'doctor_id', 'clinic_id',
    'visit_type_id', 'status', 'started_at', 'ended_at',
    'created_by', 'is_archived', 'created_at', 'updated_at',
  ],
  diagnoses: [
    'id', 'encounter_id', 'patient_id', 'doctor_id', 'disease_id',
    'icd10_code', 'diagnosis_type', 'status', 'onset_date',
    'resolved_at', 'recorded_by', 'is_archived',
    'created_at', 'updated_at',
  ],
  prescriptions: [
    'id', 'encounter_id', 'patient_id', 'doctor_id',
    'medication_catalog_id', 'route', 'frequency', 'duration',
    'status', 'start_date', 'end_date', 'prescribed_by',
    'is_archived', 'created_at', 'updated_at',
  ],
  lab_orders: [
    'id', 'encounter_id', 'patient_id', 'doctor_id',
    'status', 'ordered_at', 'resulted_at', 'ordered_by',
    'is_archived', 'created_at', 'updated_at',
  ],
  imaging_orders: [
    'id', 'encounter_id', 'patient_id', 'doctor_id',
    'imaging_type', 'body_area', 'status', 'ordered_at', 'resulted_at',
    'ordered_by', 'is_archived', 'created_at', 'updated_at',
  ],
  payments: [
    'id', 'patient_id', 'doctor_id', 'appointment_id',
    'amount', 'currency', 'status', 'payment_method',
    'created_at', 'updated_at',
  ],
  patients: [
    'id', 'user_id', 'date_of_birth', 'sex', 'blood_type',
    'is_archived', 'intake_completed_at', 'established_at',
    'created_at', 'updated_at',
  ],
  care_tasks: [
    'id', 'patient_id', 'encounter_id', 'appointment_id',
    'assigned_to', 'created_by', 'task_type', 'priority',
    'status', 'due_at', 'completed_at', 'is_archived',
    'created_at', 'updated_at',
  ],
  medical_intake: [
    'id', 'patient_id', 'status', 'collected_by', 'completed_by',
    'completed_at', 'reopened_by', 'reopened_at', 'occupation_id',
    'blood_group_id', 'marital_status', 'smoking_status',
    'alcohol_use', 'exercise_frequency', 'is_archived',
    'created_at', 'updated_at',
  ],
});

/**
 * Default filter clauses applied to every report on a given source — keeps
 * doctors from accidentally counting archived rows or test data. These
 * compose with caller-supplied filters via AND.
 */
export const REPORT_DATA_SOURCE_DEFAULT_FILTERS = Object.freeze({
  encounters:     [{ column: 'is_archived', operator: 'eq', value: false }],
  diagnoses:      [{ column: 'is_archived', operator: 'eq', value: false }],
  prescriptions:  [{ column: 'is_archived', operator: 'eq', value: false }],
  lab_orders:     [{ column: 'is_archived', operator: 'eq', value: false }],
  imaging_orders: [{ column: 'is_archived', operator: 'eq', value: false }],
  patients:       [{ column: 'is_archived', operator: 'eq', value: false }],
  care_tasks:     [{ column: 'is_archived', operator: 'eq', value: false }],
  medical_intake: [{ column: 'is_archived', operator: 'eq', value: false }],
});

// ── Column type metadata ────────────────────────────────────────────

/**
 * Column type metadata per data source. Each entry maps a column name to
 * its runtime type, human-friendly label, and — for enum columns — the
 * closed set of allowed values. For timestamp / date columns, the
 * `granularities` array lists which time-truncation levels are meaningful.
 *
 * The editor consumes this to:
 *   1. Offer type-appropriate filter operators (via REPORT_COLUMN_TYPE_OPERATORS).
 *   2. Auto-suggest granularity when a timestamp/date column is chosen for groupBy.
 *   3. Show friendly labels in table headers, filter chips, and column pickers.
 *   4. Restrict aggregation functions to those valid for the column type
 *      (via REPORT_COLUMN_TYPE_AGGREGATIONS).
 *
 * Every column in REPORT_DATA_SOURCE_COLUMNS must have an entry here.
 * Types: 'timestamp' | 'date' | 'number' | 'enum' | 'boolean' | 'text' | 'uuid'.
 */
export const REPORT_DATA_SOURCE_COLUMN_TYPES = Object.freeze({
  appointments: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    clinic_id:        { type: 'uuid',    label: 'Clinic' },
    visit_type_id:    { type: 'uuid',    label: 'Visit Type' },
    scheduled_at:     { type: 'timestamp', label: 'Scheduled At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    duration_minutes: { type: 'number',  label: 'Duration (min)' },
    status:           { type: 'enum',    label: 'Status', values: ['scheduled', 'confirmed', 'pre_check', 'in_consultation', 'completed', 'cancelled', 'no_show'] },
    booked_by:        { type: 'uuid',    label: 'Booked By' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  encounters: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    appointment_id:   { type: 'uuid',    label: 'Appointment' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    clinic_id:        { type: 'uuid',    label: 'Clinic' },
    visit_type_id:    { type: 'uuid',    label: 'Visit Type' },
    status:           { type: 'enum',    label: 'Status', values: ['planned', 'in_progress', 'completed', 'cancelled', 'entered_in_error'] },
    started_at:       { type: 'timestamp', label: 'Started At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    ended_at:         { type: 'timestamp', label: 'Ended At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    created_by:       { type: 'uuid',    label: 'Created By' },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  diagnoses: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    encounter_id:     { type: 'uuid',    label: 'Encounter' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    disease_id:       { type: 'uuid',    label: 'Disease' },
    icd10_code:       { type: 'text',    label: 'ICD-10 Code' },
    diagnosis_type:   { type: 'enum',    label: 'Diagnosis Type', values: ['primary', 'secondary', 'differential'] },
    status:           { type: 'enum',    label: 'Status', values: ['active', 'resolved', 'ruled_out', 'suspected'] },
    onset_date:       { type: 'date',    label: 'Onset Date', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    resolved_at:      { type: 'timestamp', label: 'Resolved At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    recorded_by:      { type: 'uuid',    label: 'Recorded By' },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  prescriptions: Object.freeze({
    id:                     { type: 'uuid',    label: 'ID' },
    encounter_id:           { type: 'uuid',    label: 'Encounter' },
    patient_id:             { type: 'uuid',    label: 'Patient' },
    doctor_id:              { type: 'uuid',    label: 'Doctor' },
    medication_catalog_id:  { type: 'uuid',    label: 'Medication' },
    route:                  { type: 'text',    label: 'Route' },
    frequency:              { type: 'text',    label: 'Frequency' },
    duration:               { type: 'text',    label: 'Duration' },
    status:                 { type: 'enum',    label: 'Status', values: ['draft', 'active', 'stopped', 'completed', 'cancelled'] },
    start_date:             { type: 'date',    label: 'Start Date', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    end_date:               { type: 'date',    label: 'End Date', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    prescribed_by:          { type: 'uuid',    label: 'Prescribed By' },
    is_archived:            { type: 'boolean', label: 'Archived' },
    created_at:             { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:             { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  lab_orders: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    encounter_id:     { type: 'uuid',    label: 'Encounter' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    status:           { type: 'enum',    label: 'Status', values: ['draft', 'ordered', 'in_progress', 'resulted', 'cancelled'] },
    ordered_at:       { type: 'timestamp', label: 'Ordered At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    resulted_at:      { type: 'timestamp', label: 'Resulted At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    ordered_by:       { type: 'uuid',    label: 'Ordered By' },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  imaging_orders: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    encounter_id:     { type: 'uuid',    label: 'Encounter' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    imaging_type:     { type: 'text',    label: 'Imaging Type' },
    body_area:        { type: 'text',    label: 'Body Area' },
    status:           { type: 'enum',    label: 'Status', values: ['draft', 'ordered', 'in_progress', 'resulted', 'cancelled'] },
    ordered_at:       { type: 'timestamp', label: 'Ordered At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    resulted_at:      { type: 'timestamp', label: 'Resulted At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    ordered_by:       { type: 'uuid',    label: 'Ordered By' },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  payments: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    doctor_id:        { type: 'uuid',    label: 'Doctor' },
    appointment_id:   { type: 'uuid',    label: 'Appointment' },
    amount:           { type: 'number',  label: 'Amount' },
    currency:         { type: 'text',    label: 'Currency' },
    status:           { type: 'enum',    label: 'Status', values: ['pending', 'completed', 'failed', 'refunded'] },
    payment_method:   { type: 'text',    label: 'Payment Method' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  patients: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    user_id:          { type: 'uuid',    label: 'User' },
    date_of_birth:    { type: 'date',    label: 'Date of Birth', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    sex:              { type: 'enum',    label: 'Sex', values: ['male', 'female', 'other'] },
    blood_type:       { type: 'enum',    label: 'Blood Type', values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    is_archived:      { type: 'boolean', label: 'Archived' },
    intake_completed_at: { type: 'timestamp', label: 'Intake Completed At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    established_at:   { type: 'timestamp', label: 'Established At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  care_tasks: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    encounter_id:     { type: 'uuid',    label: 'Encounter' },
    appointment_id:   { type: 'uuid',    label: 'Appointment' },
    assigned_to:      { type: 'uuid',    label: 'Assigned To' },
    created_by:       { type: 'uuid',    label: 'Created By' },
    task_type:        { type: 'enum',    label: 'Task Type', values: ['follow_up', 'call_patient', 'review_result', 'insurance', 'admin', 'other'] },
    priority:         { type: 'enum',    label: 'Priority', values: ['low', 'normal', 'high', 'urgent'] },
    status:           { type: 'enum',    label: 'Status', values: ['open', 'in_progress', 'done', 'cancelled'] },
    due_at:           { type: 'timestamp', label: 'Due At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    completed_at:     { type: 'timestamp', label: 'Completed At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
  medical_intake: Object.freeze({
    id:               { type: 'uuid',    label: 'ID' },
    patient_id:       { type: 'uuid',    label: 'Patient' },
    status:           { type: 'enum',    label: 'Status', values: ['draft', 'completed', 'reopened'] },
    collected_by:     { type: 'uuid',    label: 'Collected By' },
    completed_by:     { type: 'uuid',    label: 'Completed By' },
    completed_at:     { type: 'timestamp', label: 'Completed At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    reopened_by:      { type: 'uuid',    label: 'Reopened By' },
    reopened_at:      { type: 'timestamp', label: 'Reopened At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    occupation_id:    { type: 'uuid',    label: 'Occupation' },
    blood_group_id:   { type: 'number',  label: 'Blood Group' },
    marital_status:   { type: 'enum',    label: 'Marital Status', values: ['single', 'married', 'divorced', 'widowed', 'other'] },
    smoking_status:   { type: 'enum',    label: 'Smoking Status', values: ['never', 'former', 'current_light', 'current_heavy', 'unknown'] },
    alcohol_use:      { type: 'enum',    label: 'Alcohol Use', values: ['none', 'occasional', 'moderate', 'heavy'] },
    exercise_frequency: { type: 'enum',  label: 'Exercise Frequency', values: ['none', 'rare', 'weekly', 'daily'] },
    is_archived:      { type: 'boolean', label: 'Archived' },
    created_at:       { type: 'timestamp', label: 'Created At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
    updated_at:       { type: 'timestamp', label: 'Updated At', granularities: ['day', 'week', 'month', 'quarter', 'year'] },
  }),
});

/**
 * Completeness invariant (dev-only) — ensures REPORT_DATA_SOURCE_COLUMNS
 * and REPORT_DATA_SOURCE_COLUMN_TYPES stay in sync. Runs at module load;
 * skipped in production bundles where process.env is not available.
 */
{ /* eslint-disable no-undef -- dev-only invariant uses Node.js `process` global safely */
  const isDev = typeof process !== 'undefined'
    && typeof process.env !== 'undefined'
    && process.env.NODE_ENV !== 'production';
  if (isDev) {
    for (const [ds, cols] of Object.entries(REPORT_DATA_SOURCE_COLUMNS)) {
      const typeMap = REPORT_DATA_SOURCE_COLUMN_TYPES[ds];
      for (const col of cols) {
        if (!typeMap || !typeMap[col]) {
          throw new Error(
            `Schema drift: column "${col}" in REPORT_DATA_SOURCE_COLUMNS["${ds}"] `
            + `has no entry in REPORT_DATA_SOURCE_COLUMN_TYPES["${ds}"].`,
          );
        }
      }
    }
  }
}
/* eslint-enable no-undef */

/**
 * Filter operators appropriate for each column type. The editor uses this
 * to narrow the operator dropdown when a column is selected — e.g. a
 * boolean column only offers eq / neq / is_null / not_null, while a
 * timestamp column offers range operators (gt, gte, lt, lte).
 *
 * Every operator listed here must also appear in REPORT_FILTER_OPERATORS.
 */
export const REPORT_COLUMN_TYPE_OPERATORS = Object.freeze({
  timestamp: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is_null', 'not_null'],
  date:      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is_null', 'not_null'],
  number:    ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'is_null', 'not_null'],
  enum:      ['eq', 'neq', 'in', 'not_in', 'is_null', 'not_null'],
  boolean:   ['eq', 'neq', 'is_null', 'not_null'],
  text:      ['eq', 'neq', 'is_null', 'not_null'],
  uuid:      ['eq', 'neq', 'in', 'not_in', 'is_null', 'not_null'],
});

/**
 * Aggregation functions valid for each column type. The editor uses this
 * to filter the "aggregation column" dropdown when a function is selected
 * — e.g. 'sum' and 'avg' only accept number-type columns, while 'count'
 * works on any column (or no column at all).
 */
export const REPORT_COLUMN_TYPE_AGGREGATIONS = Object.freeze({
  timestamp: ['count', 'count_distinct', 'min', 'max'],
  date:      ['count', 'count_distinct', 'min', 'max'],
  number:    ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'],
  enum:      ['count', 'count_distinct'],
  boolean:   ['count', 'count_distinct'],
  text:      ['count', 'count_distinct'],
  uuid:      ['count', 'count_distinct'],
});

// ── Operators, aggregations, granularities ──────────────────────────

/**
 * Filter operators the compiler will accept. Each maps to a supabase-js
 * filter call (`.eq`, `.gte`, `.in`, etc.). String pattern operators are
 * intentionally absent: free-text matching on clinical columns is the
 * fastest path to a slow query + accidental PHI exposure.
 */
export const REPORT_FILTER_OPERATORS = Object.freeze([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'is_null', 'not_null',
]);

/**
 * Aggregation functions. Adding a new one means adding the corresponding
 * compiler branch + a `result_summary` shape contract.
 */
export const REPORT_AGGREGATION_FUNCTIONS = Object.freeze([
  'count', 'count_distinct', 'sum', 'avg', 'min', 'max',
]);

/**
 * Date-truncation granularity. Used when a group_by column is a timestamp
 * and the doctor wants "per month" / "per week" rollups.
 */
export const REPORT_TIME_GRANULARITIES = Object.freeze([
  'day', 'week', 'month', 'quarter', 'year',
]);

// ── Visualization types ─────────────────────────────────────────────

export const REPORT_VISUALIZATIONS = Object.freeze([
  'table',     // tabular view of the aggregated rows
  'bar',       // categorical x-axis, numeric y-axis
  'line',      // time-series y-axis
  'pie',       // single dimension, single measure share
  'kpi',       // single number (count, sum, avg) — no rows
  'stacked_bar', // categorical x, multiple measures stacked
]);

// ── Schemas ─────────────────────────────────────────────────────────

const safeColumnName = z.string()
  .trim()
  .regex(/^[a-z][a-z0-9_]*$/, 'Column names must match [a-z][a-z0-9_]*');

const filterValueSchema = z.union([
  z.string().max(240),
  z.number().finite(),
  z.boolean(),
  z.array(z.union([z.string().max(240), z.number().finite()])).max(64),
  z.null(),
]);

const filterSchema = z.object({
  column: safeColumnName,
  operator: z.enum(REPORT_FILTER_OPERATORS),
  value: filterValueSchema.optional(),
  /**
   * Bind this filter to a runtime parameter rather than a fixed value.
   * Lets the same saved report answer "this month" vs "last month" via
   * a single param the caller fills at run time.
   */
  bind: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60).optional(),
}).strict().refine(
  (f) => (f.operator === 'is_null' || f.operator === 'not_null')
    || f.value !== undefined
    || f.bind !== undefined,
  { message: 'Filter must have either a value or a bind reference.' },
);

const groupBySchema = z.object({
  column: safeColumnName,
  /** Only meaningful when the column is a timestamp. */
  granularity: z.enum(REPORT_TIME_GRANULARITIES).optional(),
  alias: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60).optional(),
}).strict();

const aggregationSchema = z.object({
  fn: z.enum(REPORT_AGGREGATION_FUNCTIONS),
  /** Required for sum/avg/min/max/count_distinct; ignored for count. */
  column: safeColumnName.optional(),
  /** Output column name in the result rows. */
  as: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60),
}).strict().refine(
  ({ fn, column }) => fn === 'count' || column !== undefined,
  { message: 'Non-count aggregations require a column.' },
);

const orderBySchema = z.object({
  /**
   * Either a group_by alias / column or an aggregation alias. The
   * compiler resolves the reference at compile time.
   */
  ref: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60),
  dir: z.enum(['asc', 'desc']).default('desc'),
}).strict();

const visualizationSchema = z.object({
  type: z.enum(REPORT_VISUALIZATIONS),
  options: z.record(z.string().max(60), z.union([
    z.string().max(240), z.number().finite(), z.boolean(),
  ])).optional(),
}).strict();

/**
 * The full report definition.
 *
 * Hard caps mirror those on document_templates: enough headroom for any
 * realistic clinical/financial report, but tight enough that an abusive or
 * runaway editor save can't push the runtime cost into a degraded zone.
 */
export const analyticalReportDefinitionSchema = z.object({
  schemaVersion: z.literal('1'),
  dataSource: z.enum(REPORT_DATA_SOURCES),
  groupBy: z.array(groupBySchema).max(4),
  aggregations: z.array(aggregationSchema).min(1).max(8),
  filters: z.array(filterSchema).max(12).optional().default([]),
  orderBy: z.array(orderBySchema).max(4).optional().default([]),
  limit: z.number().int().min(1).max(1000).default(100),
  visualization: visualizationSchema,
  header: z.object({
    title: z.string().trim().min(1).max(240),
    subtitle: z.string().trim().max(480).optional(),
    showFilters: z.boolean().optional().default(true),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  // Every column referenced (group_by, aggregations, filters, order_by)
  // must be in the source's allowlist.
  const allowed = REPORT_DATA_SOURCE_COLUMNS[value.dataSource] || [];
  const allowedSet = new Set(allowed);

  for (const g of value.groupBy) {
    if (!allowedSet.has(g.column)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['groupBy'],
        message: `Column "${g.column}" is not allowed on data source "${value.dataSource}".`,
      });
    }
  }

  for (const a of value.aggregations) {
    if (a.column && !allowedSet.has(a.column)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aggregations'],
        message: `Column "${a.column}" is not allowed on data source "${value.dataSource}".`,
      });
    }
  }

  for (const f of value.filters) {
    if (!allowedSet.has(f.column)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filters'],
        message: `Column "${f.column}" is not allowed on data source "${value.dataSource}".`,
      });
    }
  }

  // ── Type-aware validations (granularity, operators, aggregation fn) ──
  const typeMap = REPORT_DATA_SOURCE_COLUMN_TYPES[value.dataSource];

  // groupBy granularity: only timestamp/date columns may specify one,
  // and the value must be in that column's granularities list.
  for (const g of value.groupBy) {
    if (g.granularity && typeMap && typeMap[g.column]) {
      const colType = typeMap[g.column].type;
      if (colType !== 'timestamp' && colType !== 'date') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['groupBy'],
          message: `Granularity is only valid on timestamp/date columns, but "${g.column}" is ${colType}.`,
        });
      } else {
        const allowedGran = typeMap[g.column].granularities;
        if (allowedGran && !allowedGran.includes(g.granularity)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['groupBy'],
            message: `Granularity "${g.granularity}" is not valid for column "${g.column}". Allowed: ${allowedGran.join(', ')}.`,
          });
        }
      }
    }
  }

  // filter operators: must be allowed for the column's type.
  for (const f of value.filters) {
    if (typeMap && typeMap[f.column]) {
      const allowedOps = REPORT_COLUMN_TYPE_OPERATORS[typeMap[f.column].type];
      if (allowedOps && !allowedOps.includes(f.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['filters'],
          message: `Operator "${f.operator}" is not valid for column "${f.column}" (type ${typeMap[f.column].type}).`,
        });
      }
    }
  }

  // aggregation functions: must be allowed for the column's type.
  for (const a of value.aggregations) {
    if (a.column && typeMap && typeMap[a.column]) {
      const allowedFns = REPORT_COLUMN_TYPE_AGGREGATIONS[typeMap[a.column].type];
      if (allowedFns && !allowedFns.includes(a.fn)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['aggregations'],
          message: `Aggregation "${a.fn}" is not valid for column "${a.column}" (type ${typeMap[a.column].type}).`,
        });
      }
    }
  }

  // Aggregation `as` names + group_by alias/column names must be unique
  // because they collide as result-row keys.
  const resultKeys = new Set();
  for (const g of value.groupBy) {
    const key = g.alias || g.column;
    if (resultKeys.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['groupBy'],
        message: `Duplicate result key "${key}".`,
      });
    }
    resultKeys.add(key);
  }
  for (const a of value.aggregations) {
    if (resultKeys.has(a.as)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aggregations'],
        message: `Aggregation alias "${a.as}" collides with another result key.`,
      });
    }
    resultKeys.add(a.as);
  }

  // KPI viz takes a single aggregation and no groupBy — enforce that here
  // so the renderer can trust the shape.
  if (value.visualization.type === 'kpi') {
    if (value.aggregations.length !== 1 || value.groupBy.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visualization'],
        message: 'KPI visualization requires exactly one aggregation and zero group_by entries.',
      });
    }
  }

  // Pie viz takes exactly one group_by + one measure.
  if (value.visualization.type === 'pie') {
    if (value.groupBy.length !== 1 || value.aggregations.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visualization'],
        message: 'Pie visualization requires exactly one group_by and one aggregation.',
      });
    }
  }
});

// ── Wrapper schemas for service inputs ──────────────────────────────

export const analyticalReportCreateSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum([
    'clinical_activity', 'medication_usage', 'lab_workflow',
    'financial', 'operational', 'custom',
  ]),
  audience: z.enum(['doctor', 'admin', 'staff', 'public_safe']).default('staff'),
  is_default: z.boolean().default(false),
  created_by: z.string().uuid(),
});

export const analyticalReportVersionCreateSchema = z.object({
  report_id: z.string().uuid(),
  version_number: z.number().int().min(1),
  status: z.enum(['draft', 'published', 'superseded', 'archived']).default('draft'),
  is_current: z.boolean().default(false),
  definition: analyticalReportDefinitionSchema,
  definition_checksum: z.string().regex(/^[a-f0-9]{64}$/),
  created_by: z.string().uuid(),
  published_by: z.string().uuid().optional().nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'published' && !value.published_by) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['published_by'],
      message: 'published_by is required when publishing a report version.',
    });
  }
  if (value.is_current && value.status !== 'published') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['is_current'],
      message: 'is_current may only be true on a published version.',
    });
  }
});

export const analyticalReportRunRequestSchema = z.object({
  /** Either report_id (uses the current version) or version_id (pinned). */
  report_id: z.string().uuid().optional(),
  version_id: z.string().uuid().optional(),
  filter_args: z.record(
    z.string().regex(/^[a-z][a-z0-9_]*$/).max(60),
    filterValueSchema,
  ).optional().default({}),
  requested_by: z.string().uuid(),
}).strict().refine(
  (v) => Boolean(v.report_id) !== Boolean(v.version_id),
  { message: 'Pass exactly one of report_id or version_id.' },
);
