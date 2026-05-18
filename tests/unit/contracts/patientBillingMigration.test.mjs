import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  'supabase/migrations/20260518133000_patient_billing_and_form_contracts.sql'
);

describe('patient billing and configurable form migration contract', () => {
  it('extends patient form contexts for profile, booking, and billing contact', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /patient_form_field_config_form_context_check/);
    assert.match(sql, /'profile'/);
    assert.match(sql, /'appointment_booking'/);
    assert.match(sql, /'billing_contact'/);
    assert.match(sql, /'visit_reason'/);
    assert.match(sql, /'billing_email'/);
  });

  it('stores appointment custom answers behind an ownership RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /create table if not exists public\.appointment_patient_answers/);
    assert.match(sql, /create or replace function public\.submit_patient_appointment_answers/);
    assert.match(sql, /APPOINTMENT_NOT_FOUND_OR_FORBIDDEN/);
    assert.match(sql, /'visit_priority'/);
    assert.match(sql, /'preferred_contact_method'/);
    assert.match(sql, /CUSTOM_FIELD_NOT_ALLOWED/);
    assert.match(sql, /grant execute on function public\.submit_patient_appointment_answers/);
  });

  it('adds patient billing overview and receipt RPCs without direct patient writes', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /create table if not exists public\.patient_payment_checkout_sessions/);
    assert.match(sql, /create table if not exists public\.patient_payment_gateway_events/);
    assert.match(sql, /create or replace function public\.get_patient_billing_overview/);
    assert.match(sql, /create or replace function public\.get_patient_payment_receipt/);
    assert.match(sql, /grant execute on function public\.get_patient_billing_overview\(\) to authenticated, service_role/);
    assert.doesNotMatch(sql, /grant insert, update on public\.patient_payment_checkout_sessions to authenticated/);
  });

  it('keeps checkout mutation and gateway event application service-role only', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    assert.match(sql, /create_patient_payment_checkout_context/);
    assert.match(sql, /record_patient_payment_checkout_session/);
    assert.match(sql, /apply_patient_payment_gateway_event/);
    assert.match(sql, /revoke all on function public\.create_patient_payment_checkout_context\(uuid, uuid\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.apply_patient_payment_gateway_event\(text, text, text, text, text, text\) to service_role/);
    assert.match(sql, /on conflict \(provider_event_id\) do nothing/);
  });
});

describe('patient payment Edge Function contracts', () => {
  it('keeps checkout creation JWT-protected and secret-backed', () => {
    const source = readFileSync('supabase/functions/patient-create-payment-session/index.ts', 'utf8');

    assert.match(source, /STRIPE_SECRET_KEY/);
    assert.match(source, /serviceClient\.auth\.getUser\(token\)/);
    assert.match(source, /create_patient_payment_checkout_context/);
    assert.match(source, /record_patient_payment_checkout_session/);
    assert.match(source, /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions/);
    assert.doesNotMatch(source, /card_number|cvc|exp_month/i);
  });

  it('keeps Stripe webhook signature-verified and idempotent', () => {
    const source = readFileSync('supabase/functions/stripe-patient-webhook/index.ts', 'utf8');
    const deployScript = readFileSync('scripts/deploy-supabase-functions.mjs', 'utf8');

    assert.match(source, /Stripe-Signature/);
    assert.match(source, /verifyStripeSignature/);
    assert.match(source, /STRIPE_PATIENT_WEBHOOK_SECRET/);
    assert.match(source, /apply_patient_payment_gateway_event/);
    assert.match(deployScript, /stripe-patient-webhook/);
    assert.match(deployScript, /--no-verify-jwt/);
  });
});
