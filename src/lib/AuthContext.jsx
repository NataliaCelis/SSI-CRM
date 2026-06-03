import { createContext, useContext, useEffect, useState } from 'react';
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

  async function loadStaff(authUser) {
    if (!authUser) { setStaff(null); return; }
    try {
      const s = await fetchCurrentStaff(authUser.id);
      setStaff(s);
    } catch { setStaff(null); }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadStaff(u).finally(() => setLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadStaff(u);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isManager = staff?.roles?.some(r => r === 'Manager' || r === 'Sales Manager') ?? false;
  const isFullManager = staff?.roles?.includes('Manager') ?? false;

  return (
    <AuthContext.Provider value={{ user, staff, loading, isManager, isFullManager, darkMode, setDarkMode, reloadStaff: () => loadStaff(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
