import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const LogoutPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      // 1. Timeout de segurança de 3 segundos
      const timeout = setTimeout(() => {
        console.warn('Logout timeout reached, forcing redirection');
        window.location.href = '/login';
      }, 3000);

      try {
        // a) Chamar signOut do Supabase
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error('Supabase signOut error:', e);
        }

        // b) Limpar localStorage e sessionStorage
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          sessionStorage.clear();
        } catch (e) {
          console.error('Storage clear error:', e);
        }

        // c) O hook useAuth signOut já limpa o estado local
        // Mas vamos chamar o signOut do hook para garantir a consistência do estado do React
        try {
          await signOut();
        } catch (e) {
          console.error('Auth hook signOut error:', e);
        }

      } finally {
        clearTimeout(timeout);
        // d) Redirecionar para /login (garantido pelo window.location.href no signOut ou aqui)
        if (window.location.pathname !== '/login') {
          navigate('/login');
        }
      }
    };

    performLogout();
  }, [navigate, signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground animate-pulse">Encerrando sessão...</p>
      </div>
    </div>
  );
};

export default LogoutPage;
