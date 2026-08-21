import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  status: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isCoordinator: boolean;
  isAdminOrCoordinator: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('fetchProfile started for:', userId);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (profileError) console.error('Error fetching profile:', profileError);
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) console.error('Error fetching roles:', rolesError);

      console.log('Roles fetched:', rolesData?.map(r => r.role));
      setProfile(profileData);
      setRoles(rolesData?.map(r => r.role) || []);
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    // 4. Safety timeout to prevent permanent loading screen
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // 1 & 2. Synchronous updates and deferred profile fetch
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            if (event === 'SIGNED_IN') {
              logActivity('Login', { method: 'auth', email: session.user.email });
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        
        setLoading(false);
      }
    );

    // 3. Deferred initSession using .then()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      }
      setLoading(false);
      clearTimeout(safetyTimeout);
    }).catch(err => {
      console.error('Error in initSession:', err);
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await logActivity('Logout');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const isAdmin = roles.includes('admin');
  const isOwner = roles.includes('owner');
  const isCoordinator = roles.includes('coordinator');

  const isAdminOrCoordinator = isAdmin || isCoordinator || isOwner;

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading,
      isAdmin, isOwner, isCoordinator,
      isAdminOrCoordinator,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
