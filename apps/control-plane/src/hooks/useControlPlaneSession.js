import { useCallback, useEffect, useState } from 'react';
import { controlPlaneApi } from '../lib/controlPlaneApi';
import { getControlPlaneEnvStatus } from '../lib/controlPlaneClient';

/**
 * useControlPlaneSession — owns env-check + session-restore + auth subscription.
 *
 * Extracted from App.jsx per `apps/control-plane/REFACTOR_PLAN.md` Slice 1
 * (handoff §8 Task 3). Behavior is preserved exactly:
 *
 *   - `envStatus` is resolved synchronously on first render. The configuration
 *     does not change at runtime, so we cache the result.
 *   - `booting` defaults to true only when the env is configured; if the env
 *     is missing, the caller renders <MissingEnvScreen> and `booting` is
 *     irrelevant.
 *   - Session restore + `onAuthStateChange` subscription run only when the
 *     env is configured (same guard as before).
 *   - Cleanup unsubscribes on unmount.
 *   - `setSession` is exposed so existing `LoginScreen` can keep its
 *     `onSignedIn={setSession}` callback shape — preserves the synchronous
 *     redirect after sign-in.
 *   - `signOut` wraps `controlPlaneApi.signOut()` and clears local state, so
 *     the consumer doesn't need to mirror the call.
 *
 * @returns {{
 *   envStatus: { hasUrl: boolean, hasAnonKey: boolean },
 *   session: import('@supabase/supabase-js').Session | null,
 *   booting: boolean,
 *   setSession: (session: object | null) => void,
 *   signOut: () => Promise<void>,
 * }}
 */
export function useControlPlaneSession() {
  // The env-status lookup is environment-driven and never changes during a
  // session, so we resolve it once via lazy initialiser and reuse the result.
  const [envStatus] = useState(() => getControlPlaneEnvStatus());
  const isConfigured = envStatus.hasUrl && envStatus.hasAnonKey;

  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return undefined;

    let isMounted = true;
    void controlPlaneApi.getSession().then((result) => {
      if (!isMounted) return;
      setSession(result.data);
      setBooting(false);
    });

    const { data: { subscription } } = controlPlaneApi.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signOut = useCallback(async () => {
    controlPlaneApi.abortPendingAdminRequests();
    setSession(null);
    await controlPlaneApi.signOut();
  }, []);

  return { envStatus, session, booting, setSession, signOut };
}
