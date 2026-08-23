import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
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
  clearAuthState: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoadFailed, setPermissionsLoadFailed] = useState(false);
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

      if (profileData) setProfile(profileData);
      if (rolesData) setRoles(rolesData.map(r => r.role) || []);
      setPermissionsLoadFailed(false);
    } catch (err: any) {
      console.error(`Attempt ${retryCount + 1} failed for fetchProfile:`, err);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => fetchProfile(userId, retryCount + 1), delay);
      } else {
        setPermissionsLoadFailed(true);
        // Toast removido para ser silencioso, a faixa UI cuidará do aviso
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
        const currentUser = session?.user ?? null;
        setSession(session);
        setUser(currentUser);
        
        if (currentUser) {
          // Apenas busca se o usuário mudou ou se é um evento de login explícito
          await fetchProfile(currentUser.id);
          if (event === 'SIGNED_IN') {
            logActivity('Login', { method: 'auth', email: currentUser.email });
          }
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // O getSession ainda é necessário para o carregamento inicial caso onAuthStateChange demore
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setSession(session);
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
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

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
    setFetchingUserId(null);
    setPermissionsLoadFailed(false);
  };

  const signOut = async () => {
    // Agora o botão Sair navega para /logout, mas mantemos o método por compatibilidade se invocado programaticamente
    window.location.href = '/logout';
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
      signOut, clearAuthState, refreshProfile,
    }}>
      {permissionsLoadFailed && !loading && session && 
       !['/login', '/register', '/reset-password', '/logout', '/form', '/timeline/public'].some(p => window.location.pathname.startsWith(p)) && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-destructive text-destructive-foreground p-4 rounded-lg shadow-2xl flex items-center gap-4 max-w-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex-1">
            <p className="font-bold text-sm">Falha na Sincronização</p>
            <p className="text-xs opacity-90">Não foi possível carregar suas permissões. Algumas ações podem falhar.</p>
          </div>
          <button 
            onClick={() => user && fetchProfile(user.id)}
            className="px-3 py-1 bg-background text-foreground rounded text-xs font-bold hover:bg-background/90 transition-colors"
          >
            Tentar agora
          </button>
        </div>
      )}

      {session && !loading && roles.length === 0 && 
       !['/login', '/register', '/reset-password', '/logout', '/form', '/timeline/public'].some(p => window.location.pathname.startsWith(p)) ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground max-w-sm mb-8">
            Sua conta ainda não tem acesso a este espaço de trabalho. Peça um convite ao administrador para começar.
          </p>
          <button 
            onClick={() => window.location.href = '/logout'}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            Sair da conta
          </button>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
