import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, fetchCurrentStaff } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // Supabase auth user
  const [staff, setStaff] = useState(null);       // Staff record with roles
  const [loading, setLoading] = useState(true);

  async function loadStaff(authUser) {
    if (!authUser) { setStaff(null); return; }
    try {
      const s = await fetchCurrentStaff(authUser.id);
      setStaff({
        ...s,
        roles: s.staff_roles?.map(r => r.role) || [],
      });
    } catch {
      setStaff(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      loadStaff(u).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadStaff(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isManager = staff?.roles?.some(r => r === 'Manager' || r === 'Sales Manager') ?? false;
  const isSalesManager = staff?.roles?.includes('Sales Manager') ?? false;
  const isFullManager = staff?.roles?.includes('Manager') ?? false;

  return (
    <AuthContext.Provider value={{ user, staff, loading, isManager, isSalesManager, isFullManager, reloadStaff: () => loadStaff(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
