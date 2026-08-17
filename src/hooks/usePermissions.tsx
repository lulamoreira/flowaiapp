import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ModulePermission {
  can_edit: boolean;
  can_delete: boolean;
}

/**
 * Permissões efetivas do usuário atual.
 *
 * Regra principal: o papel "viewer" SEMPRE sobrepõe qualquer permissão de edição
 * concedida por funções customizadas. Visualizador só pode visualizar.
 *
 * - Admin / Coordinator: acesso total (can_edit / can_delete = true em tudo).
 * - Outros papéis (manager, user...): herdam as permissões da(s) função(ões)
 *   customizada(s) atribuída(s).
 * - Viewer: ignora completamente as permissões da função e fica somente leitura.
 */
export function usePermissions() {
  const { user, isAdmin, isCoordinator, roles, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});
  const [loading, setLoading] = useState(true);

  const isViewer = roles?.includes('viewer') && !isAdmin && !isCoordinator;
  const isAdminOrCoordinator = isAdmin || isCoordinator;

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Admin / Coordinator: tudo liberado, não precisa consultar funções.
    if (isAdminOrCoordinator) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Viewer: sempre read-only, ignora funções.
    if (isViewer) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const { data: userFuncs } = await supabase
      .from('user_custom_functions')
      .select('function_id')
      .eq('user_id', user.id);

    const funcIds = userFuncs?.map(f => f.function_id) ?? [];
    if (funcIds.length === 0) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const { data: perms } = await supabase
      .from('function_permissions')
      .select('module, can_edit, can_delete')
      .in('function_id', funcIds);

    const merged: Record<string, ModulePermission> = {};
    perms?.forEach(p => {
      const cur = merged[p.module] ?? { can_edit: false, can_delete: false };
      merged[p.module] = {
        can_edit: cur.can_edit || !!p.can_edit,
        can_delete: cur.can_delete || !!p.can_delete,
      };
    });

    setPermissions(merged);
    setLoading(false);
  }, [user, isAdminOrCoordinator, isViewer]);

  useEffect(() => {
    if (!authLoading) fetchPermissions();
  }, [authLoading, fetchPermissions]);

  const canEdit = useCallback(
    (module?: string) => {
      if (isViewer) return false; // viewer sobrepõe tudo
      if (isAdminOrCoordinator) return true;
      if (!module) return false;
      return !!permissions[module]?.can_edit;
    },
    [isViewer, isAdminOrCoordinator, permissions],
  );

  const canDelete = useCallback(
    (module?: string) => {
      if (isViewer) return false;
      if (isAdminOrCoordinator) return true;
      if (!module) return false;
      return !!permissions[module]?.can_delete;
    },
    [isViewer, isAdminOrCoordinator, permissions],
  );

  return {
    loading: loading || authLoading,
    isViewer,
    isAdminOrCoordinator,
    permissions,
    canEdit,
    canDelete,
  };
}
