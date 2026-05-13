# `authService` — sign in, sign up, OTP, session

**File:** `packages/core/services/auth.js`
**Schemas:** `packages/core/schemas/auth.js`,
`packages/core/schemas/responses.js`

Supabase Auth is the only session source of truth. This service is a thin
wrapper that adds validation, role-aware redirect handling, and contract
checks before the UI sees the session.

## Methods

### `signIn(email, password)`

Password login.

- **Input schema:** `authSignInSchema` (email + min-length password).
- **Steps:**
  1. Validate input.
  2. Call `supabase.auth.signInWithPassword`.
  3. Fetch session, sign out if missing.
  4. Resolve linked profile via `getProfileForSessionUser` (waits for
     pending provisioning if the row hasn't synced yet).
  5. Build the session user via `buildSessionUserOrSignOut`.
  6. **F3 response validation:** the built session user is checked against
     `sessionUserResponseSchema` (id UUID, role enum). Failure ⇒ sign out
     + `'Sign-in returned an unexpected user shape.'` error.
- **Returns:** `{ data: SessionUser, error: null }` or
  `{ data: null, error: string }`.
- **Failure modes:**
  - `'Invalid email or password'` — Supabase rejected the credential.
  - `'Authenticated session could not be established.'` — login succeeded
    but session didn't materialize (rare; client-side race).
  - `'User profile not found or account is inactive'` — auth user exists
    but no linked `users` row, or the user is archived.

### `requestEmailOtp(email)`

Send a one-time code email.

- **Input schema:** `authOtpRequestSchema`.
- **Important:** `shouldCreateUser: false` — won't create an account for
  unknown emails. This prevents enumeration of valid clinic users from a
  stranger.
- **Redirect URL:** `getCurrentPageRedirectTo()` — uses the current
  origin + pathname so tenant-routed (`/t/<slug>/login`) and custom-domain
  flows both work without server config.
- **Rate-limit handling:** detects Supabase's
  `over_email_send_rate_limit` (4/hour on default SMTP) and surfaces a
  friendly message.

### `verifyEmailOtp(email, token)`

Verify a code from the OTP email and finish sign-in.

- **Input schema:** `authOtpVerifySchema` (email + 6-digit token).
- **Same post-auth flow as `signIn`** (profile fetch + session build).
- **Returns:** identical envelope.

### `signUp(email, password, firstName, lastName)`

Patient self-registration. Creates the Auth user, links a `users` row,
returns the session.

- **Input schema:** `authSignUpSchema`.
- **Role:** always `'patient'`. Staff accounts come through `staffService`
  invite, not this path.
- **Compensation:** if the post-signup `users` insert fails, the Auth user
  is left intact (Supabase's email-confirmation flow handles the cleanup
  on its own — see `authIdentity.js`).

### `requestPasswordReset(email)` and `resetPassword(token, newPassword)`

Standard Supabase Auth reset flow with `forgotPasswordSchema` /
`resetPasswordSchema` validation. The redirect URL points at
`/reset-password` on the current origin so tenant-routed flows work.

### `signOut()`

Clears the Supabase session. AuthContext listens for `SIGNED_OUT` and
unwinds local state.

## Conventions specific to this service

- **No second auth listener.** `AuthProvider` already wires
  `supabase.auth.onAuthStateChange` and enforces a 30-minute idle timeout.
  Don't add another listener — extend the provider instead.
- **Sign-out is the safe failure mode.** Any post-auth step that goes
  wrong calls `supabase.auth.signOut()` before returning an error. This
  prevents the UI from rendering in an authenticated-but-broken state.
- **F3 response validation guards against contract drift.** If a future
  refactor accidentally returns a different shape from
  `buildSessionUserOrSignOut`, sign-in fails cleanly instead of silently
  rendering a half-broken dashboard.

## Related

- Profile resolution: `packages/core/lib/authIdentity.js`.
- Display name / initials: `packages/core/lib/userDisplay.js` (use these
  helpers in UI — never inline `${user.first_name}`).
- Idle timeout: `AuthProvider` in `packages/ui/contexts/AuthContext.jsx`.
