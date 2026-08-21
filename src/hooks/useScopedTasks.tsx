import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import type { Task } from '@/types';

/**
 * Returns tasks filtered by the current user's scope:
 * - Admin / Coordinator: see all tasks
 * - Everyone else: only tasks where assignee === current user
 *
 * Use this everywhere we display "task" stats, lists, charts, kanban etc.
 * so the user-scope is enforced consistently across the app.
 */
export function useScopedTasks(): {
  tasks: Task[];
  isPrivileged: boolean;
  scopeUserId: string | null;
  filterTasks: <T extends { assignee?: string | null }>(items: T[]) => T[];
} {
  const { state } = useAppStore();
  const { profile, roles, isOwner } = useAuth();

  const isPrivileged = roles.includes('admin') || roles.includes('coordinator') || isOwner;
  const scopeUserId = profile?.user_id ?? null;

  const tasks = useMemo(() => {
    if (isPrivileged) return state.tasks;
    if (!scopeUserId) return [];
    return state.tasks.filter(t => t.assignee === scopeUserId);
  }, [state.tasks, isPrivileged, scopeUserId]);

  const filterTasks = <T extends { assignee?: string | null }>(items: T[]): T[] => {
    if (isPrivileged) return items;
    if (!scopeUserId) return [];
    return items.filter(i => i.assignee === scopeUserId);
  };

  return { tasks, isPrivileged, scopeUserId, filterTasks };
}
