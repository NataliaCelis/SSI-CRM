import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, fetchCurrentStaff } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') !== 'false');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const loadStaff = useCallback(async (authUser) => {
    if (!authUser) { setStaff(null); return; }
    // Retry up to 3 times — Supabase can be slow on first auth event
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const s = await fetchCurrentStaff(authUser.id);
        if (s) {
          setStaff(s);
          return;
        }
      } catch (err) {
        if (attempt === 2) {
          console.warn('Could not load staff record after 3 attempts:', err.message);
          setStaff(null);
        } else {
          // Wait 500ms before retry
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadStaff(u).finally(() => setLoading(false));
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // Always reload staff on any auth event to ensure roles are fresh
      await loadStaff(u);
    });

    return () => subscription.unsubscribe();
  }, [loadStaff]);

  // Derive permissions fresh from staff object every render
  const roles = staff?.roles || [];
  const isManager = roles.some(r => r === 'Manager' || r === 'Sales Manager');
  const isFullManager = roles.includes('Manager');

  return (
    <AuthContext.Provider value={{
      user, staff, loading,
      isManager, isFullManager,
      darkMode, setDarkMode,
      reloadStaff: () => loadStaff(user),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
