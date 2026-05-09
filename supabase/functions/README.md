# Edge Functions

Five tenant Edge Functions are canonical in the current backend contract:

- `staff-invite`: authenticated doctor staff onboarding. It validates the
  caller, sends a Supabase Auth invite with server-side service-role access,
  writes domain identity through `create_staff_invite_domain_identity`, and
  compensates failed domain writes by soft-deleting the just-created Auth
  identity.
- `staff-member-disable`: authenticated staff invite cancellation and accepted
  staff access disable. It validates the caller, calls
  `disable_staff_member_domain_identity` with server-side service-role access,
  soft-deletes only pending/non-accepted Auth identities, and keeps accepted
  Auth identities recoverable for a future reactivation workflow.
- `staff-invite-resend`: authenticated pending-invite resend workflow. It
  validates the caller, creates an idempotent `staff_invite_resend_events`
  row through `create_staff_invite_resend_event`, sends the Supabase Auth
  invite with server-side service-role access, and finalizes the event through
  `finish_staff_invite_resend_event` as `sent` or `failed`.
- `staff-invite-reissue`: authenticated cancelled-pending-invite recovery
  workflow. It validates the caller, creates an idempotent
  `staff_invite_reissue_events` row, sends a new Supabase Auth invite, relinks
  the tenant domain user through `finish_staff_invite_reissue_event`, and can
  be undone by the existing staff disable/cancel workflow.
- `staff-member-reactivate`: authenticated accepted-staff undo workflow. It
  validates the caller and calls `reactivate_staff_member_domain_identity` with
  service-role access. v1 only reactivates staff whose previous disabled state
  was `accepted`; cancelled pending invites use `staff-invite-reissue`.

The web app talks to Supabase through the frontend service layer, shared Zod
schemas, canonical RPCs, RLS-protected tables, and approved Edge Functions.
Future Edge Functions should only be added when they are truly needed for
server-side orchestration, such as notification delivery workers, signed
document URL helpers, or controlled purge workflows.

Do not recreate the retired V1 wrappers:

- `auth`
- `appointments`
- `patients`
- `consultations`
- `referrals`
- `process-payment`

If an Edge Function is added later, document its canonical owner in
`BACKEND_CONTRACT_LEDGER.md` and make sure it validates input, authorizes the
caller, calls the canonical RPC/service path, and returns the standard envelope.
