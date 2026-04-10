import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] animate-pulse" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.some(r => roles.includes(r));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
