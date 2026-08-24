import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
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
  const isFetchingRef = useRef(false);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<number>(0);
  const lastFetchAttemptRef = useRef<number>(0);
  const isCircuitBreakerOpenRef = useRef<boolean>(false);
  const hasFetchedOnceRef = useRef<boolean>(false);
  const userIdRef = useRef<string | null>(null);

  // Dependências VAZIAS: identidade estável para toda a vida do provider.
  const fetchProfile = useCallback(async (userId: string, isManualRetry = false) => {
    const now = Date.now();
    const cooldown = 30000; // 30s
    const isFirstFetch = !hasFetchedOnceRef.current;

    // Trava de concorrência (ref, não state — não causa re-render nem remount)
    if (isFetchingRef.current) return;
    // O disjuntor e o cooldown nunca bloqueiam a PRIMEIRA busca após o carregamento
    if (!isFirstFetch) {
      if (isCircuitBreakerOpenRef.current && !isManualRetry) return;
      if (!isManualRetry && retryCountRef.current === 0 && now - lastFetchAttemptRef.current < cooldown) {
        return;
      }
    }

    isFetchingRef.current = true;
    hasFetchedOnceRef.current = true;

    if (isManualRetry || isFirstFetch) {
      retryCountRef.current = 0;
      isCircuitBreakerOpenRef.current = false;
      setPermissionsLoadFailed(false);
    }

    if (fetchControllerRef.current) fetchControllerRef.current.abort();
    fetchControllerRef.current = new AbortController();

    try {
      lastFetchAttemptRef.current = Date.now();
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
      setRoles(rolesData ? rolesData.map((r) => r.role) : []);

      setPermissionsLoadFailed(false);
      retryCountRef.current = 0;
      isCircuitBreakerOpenRef.current = false;
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      console.error(`Attempt ${retryCountRef.current + 1} failed for fetchProfile:`, err);
      retryCountRef.current += 1;

      if (retryCountRef.current < 3) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(() => {
          isFetchingRef.current = false;
          fetchProfile(userId, true);
        }, delay);
        return;
      }
      isCircuitBreakerOpenRef.current = true;
      setPermissionsLoadFailed(true);
    } finally {
      isFetchingRef.current = false;
      if (retryCountRef.current === 0 || retryCountRef.current >= 3) {
        setLoading(false);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userIdRef.current) {
      await fetchProfile(userIdRef.current, true);
    }
  }, [fetchProfile]);

  const clearAuthState = useCallback(() => {
    userIdRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
    isFetchingRef.current = false;
    setPermissionsLoadFailed(false);
    retryCountRef.current = 0;
    isCircuitBreakerOpenRef.current = false;
  }, []);

  const signOut = useCallback(async () => {
    window.location.href = '/logout';
  }, []);

  // Roda UMA vez. Sem dependências reativas: nada de remount/unsubscribe em loop.
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const currentUser = newSession?.user ?? null;
      // Atualização SÍNCRONA apenas — nenhum await de chamada ao banco aqui.
      setSession(newSession);
      setUser(currentUser);
      userIdRef.current = currentUser?.id ?? null;

      if (currentUser) {
        const uid = currentUser.id;
        setTimeout(() => {
          fetchProfile(uid, event === 'SIGNED_IN');
          if (event === 'SIGNED_IN') {
            logActivity('Login', { method: 'auth', email: currentUser.email });
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        clearAuthState();
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      const currentUser = initialSession?.user ?? null;
      setSession(initialSession);
      setUser(currentUser);
      userIdRef.current = currentUser?.id ?? null;
      clearTimeout(safetyTimeout);

      if (currentUser) {
        retryCountRef.current = 0;
        setTimeout(() => fetchProfile(currentUser.id), 0);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Error in getSession:', err);
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const rolesString = JSON.stringify(roles);
  const isAdmin = useMemo(() => roles.includes('admin') || roles.includes('owner'), [rolesString]);
  const isOwner = useMemo(() => roles.includes('owner'), [rolesString]);
  const isCoordinator = useMemo(() => roles.includes('coordinator') || roles.includes('admin') || roles.includes('owner'), [rolesString]);
  const isAdminOrCoordinator = useMemo(() => isAdmin || isCoordinator || isOwner, [isAdmin, isCoordinator, isOwner]);

  const contextValue = useMemo(() => ({
    user, session, profile, roles, loading,
    isAdmin, isOwner, isCoordinator,
    isAdminOrCoordinator,
    signOut, clearAuthState, refreshProfile,
  }), [
    user?.id, session?.access_token, profile?.id, rolesString, loading,
    isAdmin, isOwner, isCoordinator,
    isAdminOrCoordinator,
    signOut, clearAuthState, refreshProfile
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {permissionsLoadFailed && !loading && session && 
       !['/login', '/register', '/reset-password', '/logout', '/form', '/timeline/public'].some(p => window.location.pathname.startsWith(p)) && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-destructive text-destructive-foreground p-4 rounded-lg shadow-2xl flex items-center gap-4 max-w-md animate-in fade-in slide-in-from-bottom-4">
          <div className="flex-1">
            <p className="font-bold text-sm">Falha na Sincronização</p>
            <p className="text-xs opacity-90">Não foi possível carregar suas permissões. Algumas ações podem falhar.</p>
          </div>
          <button 
            onClick={() => user?.id && fetchProfile(user.id, true)}
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
