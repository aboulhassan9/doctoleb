import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        authService.getCurrentUser().then(({ data }) => {
          if (data) {
            setUser(data);
            authService.setUserSession(data.email, data.role, data.patient_id);
          }
        });
      }
      setLoading(false);
    });

    // Keep user state in sync with Supabase Auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data } = await authService.getCurrentUser();
        if (data) {
          setUser(data);
          authService.setUserSession(data.email, data.role, data.patient_id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
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
      setLoading(false);
    }
  };

  const signUp = async (email, password, firstName, lastName) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await authService.signUp(email, password, firstName, lastName);
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
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setError(null);
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
