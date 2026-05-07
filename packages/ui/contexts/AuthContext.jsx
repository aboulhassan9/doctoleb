import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/auth';

const AuthContext = createContext();
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const authActionInFlightRef = useRef(false);
  const idleTimeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const syncCurrentUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession().catch((sessionError) => {
          throw sessionError;
        });

        if (!session) {
          if (isMounted) {
            setUser(null);
            setError(null);
          }
          return;
        }

        const { data, error: currentUserError } = await authService.getCurrentUser();
        if (currentUserError) {
          await authService.logout();
          if (isMounted) {
            setUser(null);
            setError(currentUserError);
          }
          return;
        }

        if (isMounted && data) {
          setUser(data);
          authService.setUserSession(data.email, data.role, data.patient_id);
        }
      } catch (sessionError) {
        if (isMounted) {
          setError(sessionError.message || 'Failed to restore your session.');
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void syncCurrentUser();

    // Keep user state in sync with Supabase Auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const handleAuthChange = async () => {
        try {
          if (event === 'SIGNED_IN' && session) {
            const { data, error: currentUserError } = await authService.getCurrentUser();
            if (currentUserError) {
              setError(currentUserError);
              return;
            }

            if (data) {
              setUser(data);
              setError(null);
              authService.setUserSession(data.email, data.role, data.patient_id);
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setError(null);
          }
        } catch (authChangeError) {
          setError(authChangeError.message || 'Authentication state update failed.');
        }
      };

      void handleAuthChange();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      return undefined;
    }

    const resetIdleTimer = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      idleTimeoutRef.current = window.setTimeout(async () => {
        await authService.logout();
        setUser(null);
        setError('Your session expired after 30 minutes of inactivity.');
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [user]);

  const signIn = async (email, password) => {
    if (authActionInFlightRef.current) {
      return { success: false, error: 'Authentication is already in progress.' };
    }

    authActionInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await authService.signIn(email, password);
      if (error) {
        setError(error);
        return { success: false, error };
      }
      authService.setUserSession(data.email, data.role, data.patient_id);
      setUser(data);
      return { success: true, user: data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      authActionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const signUp = async (email, password, firstName, lastName) => {
    if (authActionInFlightRef.current) {
      return { success: false, error: 'Authentication is already in progress.' };
    }

    authActionInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await authService.signUp(email, password, firstName, lastName);
      if (error) {
        setError(error);
        return { success: false, error };
      }
      if (data?.pendingConfirmation) {
        setUser(null);
        return {
          success: true,
          pendingConfirmation: true,
          email: data.email,
        };
      }
      authService.setUserSession(data.email, data.role, data.patient_id);
      setUser(data);
      return { success: true, user: data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      authActionInFlightRef.current = false;
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const { error: logoutError } = await authService.logout();
      if (logoutError) {
        setError(logoutError);
        return { success: false, error: logoutError };
      }

      setUser(null);
      setError(null);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signUp, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
