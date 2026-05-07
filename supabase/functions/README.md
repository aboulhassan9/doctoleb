# Edge Functions

No Edge Functions are canonical in the current backend contract.

The web app talks to Supabase through the frontend service layer, shared Zod
schemas, canonical RPCs, and RLS-protected tables. Future Edge Functions should
only be added when they are truly needed for server-side orchestration, such as
notification delivery workers, signed document URL helpers, or controlled purge
workflows.

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
