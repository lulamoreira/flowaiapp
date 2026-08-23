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
  const [authError, setAuthError] = useState<string | null>(null);
  const [fetchingUserId, setFetchingUserId] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, retryCount = 0) => {
    if (fetchingUserId === userId && retryCount === 0) return;
    setFetchingUserId(userId);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileError) throw profileError;
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      setProfile(profileData);
      setRoles(rolesData?.map(r => r.role) || []);
      setAuthError(null);
    } catch (err: any) {
      console.error(`Attempt ${retryCount + 1} failed for fetchProfile:`, err);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => fetchProfile(userId, retryCount + 1), delay);
      } else {
        setAuthError('Não foi possível carregar as permissões do usuário.');
        toast.error('Erro ao carregar permissões. Algumas funcionalidades podem estar limitadas.');
      }
    } finally {
      if (retryCount === 0 || retryCount === 3) {
        setLoading(false);
        setFetchingUserId(null);
      }
    }
  }, [fetchingUserId]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
          if (event === 'SIGNED_IN') {
            logActivity('Login', { method: 'auth', email: session.user.email });
          }
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
      clearTimeout(safetyTimeout);
    }).catch(err => {
      console.error('Error in getSession:', err);
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [fetchProfile]);

  const signOut = async () => {
    const clearState = () => {
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      window.location.href = '/login';
    };

    // Garantia de 3 segundos para limpar estado e redirecionar
    const timeout = setTimeout(clearState, 3000);

    try {
      // 1. Chama signOut do Supabase primeiro
      await supabase.auth.signOut();
      
      // 2. Limpa estado e limpa timeout
      clearTimeout(timeout);
      clearState();
      
      // 3. Registra log sem await e em try/catch
      try {
        logActivity('Logout');
      } catch (logErr) {
        console.error('Error logging logout:', logErr);
      }
    } catch (err) {
      console.error('Error during signOut:', err);
      clearTimeout(timeout);
      clearState();
    }
  };

  const isAdmin = roles.includes('admin') || roles.includes('owner');
  const isOwner = roles.includes('owner');
  const isCoordinator = roles.includes('coordinator') || roles.includes('admin') || roles.includes('owner');

  const isAdminOrCoordinator = isAdmin || isCoordinator || isOwner;

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading,
      isAdmin, isOwner, isCoordinator,
      isAdminOrCoordinator,
      signOut, refreshProfile,
    }}>
      {authError && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-destructive text-destructive-foreground p-4 rounded-lg shadow-2xl flex items-center gap-4 max-w-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex-1">
            <p className="font-bold text-sm">Erro de Permissão</p>
            <p className="text-xs opacity-90">{authError}</p>
          </div>
          <button 
            onClick={() => user && fetchProfile(user.id)}
            className="px-3 py-1 bg-background text-foreground rounded text-xs font-bold hover:bg-background/90 transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
