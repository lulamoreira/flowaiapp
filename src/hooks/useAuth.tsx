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

  // Travas e disjuntor vivem em refs: mudar estado aqui recriaria a funcao
  // e faria o efeito principal remontar em ciclo (bug do "Acesso Restrito").
  const isFetchingRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const lastFetchAttemptRef = useRef<number>(0);
  const isCircuitBreakerOpenRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Dependencias VAZIAS de proposito: esta funcao precisa ser estavel.
  const fetchProfile = useCallback(async (userId: string, isManualRetry = false) => {
    const cooldown = 30000; // 30s entre sequencias de tentativa

    if (isFetchingRef.current) return;
    if (isCircuitBreakerOpenRef.current && !isManualRetry) return;

    // A espera minima nunca vale para a primeira busca da pagina
    // (lastFetchAttemptRef comeca em 0), so entre sequencias de retentativa.
    if (
      !isManualRetry &&
      retryCountRef.current === 0 &&
      lastFetchAttemptRef.current > 0 &&
      Date.now() - lastFetchAttemptRef.current < cooldown
    ) {
      return;
    }

    isFetchingRef.current = true;

    if (isManualRetry) {
      retryCountRef.current = 0;
      isCircuitBreakerOpenRef.current = false;
      setPermissionsLoadFailed(false);
    }

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
      if (rolesData) setRoles(rolesData.map(r => r.role) || []);

      setPermissionsLoadFailed(false);
      retryCountRef.current = 0;
      isCircuitBreakerOpenRef.current = false;
    } catch (err: any) {
      console.error(`Attempt ${retryCountRef.current + 1} failed for fetchProfile:`, err);
      retryCountRef.current += 1;

      if (retryCountRef.current < 3) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(() => {
          if (currentUserIdRef.current) fetchProfile(currentUserIdRef.current);
        }, delay);
      } else {
        // Disjuntor abre: para de tentar sozinho ate acao explicita do usuario.
        isCircuitBreakerOpenRef.current = true;
        setPermissionsLoadFailed(true);
      }
    } finally {
      isFetchingRef.current = false;
      if (retryCountRef.current === 0 || retryCountRef.current >= 3) {
        setLoading(false);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentUserIdRef.current) {
      await fetchProfile(currentUserIdRef.current, true);
    }
  }, [fetchProfile]);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
    setPermissionsLoadFailed(false);
    isFetchingRef.current = false;
    retryCountRef.current = 0;
    isCircuitBreakerOpenRef.current = false;
    lastFetchAttemptRef.current = 0;
    currentUserIdRef.current = null;
  }, []);

  const signOut = useCallback(async () => {
    window.location.href = '/logout';
  }, []);

  // Efeito principal roda UMA vez. fetchProfile e clearAuthState sao estaveis.
  useEffect(() => {
    // Estado limpo a cada carregamento da pagina: o disjuntor nunca pode
    // impedir a primeira busca.
    isFetchingRef.current = false;
    retryCountRef.current = 0;
    isCircuitBreakerOpenRef.current = false;
    lastFetchAttemptRef.current = 0;

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Somente atualizacoes sincronas aqui. Chamar o banco dentro deste
        // callback causa impasse no cliente Supabase.
        const currentUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(currentUser);
        currentUserIdRef.current = currentUser?.id ?? null;

        if (currentUser) {
          if (event === 'SIGNED_IN') {
            const uid = currentUser.id;
            setTimeout(() => {
              fetchProfile(uid, true);
              logActivity('Login', { method: 'auth', email: currentUser.email });
            }, 0);
          }
        } else {
          clearAuthState();
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      const currentUser = initialSession?.user ?? null;
      setSession(initialSession);
      setUser(currentUser);
      currentUserIdRef.current = currentUser?.id ?? null;

      if (currentUser) {
        const uid = currentUser.id;
        setTimeout(() => fetchProfile(uid), 0);
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
            onClick={() => currentUserIdRef.current && fetchProfile(currentUserIdRef.current, true)}
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
