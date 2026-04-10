import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useState } from 'react';
import { Board, TaskGroup, Task, User, AutomationRule } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { useAuth } from '@/hooks/useAuth';

interface AppState {
  boards: Board[];
  groups: TaskGroup[];
  tasks: Task[];
  users: User[];
  automations: AutomationRule[];
  loading: boolean;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_BOARD'; payload: Board }
  | { type: 'UPDATE_BOARD'; payload: Board }
  | { type: 'DELETE_BOARD'; payload: string }
  | { type: 'ADD_GROUP'; payload: TaskGroup }
  | { type: 'UPDATE_GROUP'; payload: TaskGroup }
  | { type: 'DELETE_GROUP'; payload: string }
  | { type: 'TOGGLE_GROUP'; payload: string }
  | { type: 'ADD_AUTOMATION'; payload: AutomationRule }
  | { type: 'TOGGLE_AUTOMATION'; payload: string }
  | { type: 'DELETE_AUTOMATION'; payload: string }
  | { type: 'ADD_USER'; payload: User };

const initialState: AppState = {
  boards: [],
  groups: [],
  tasks: [],
  users: [],
  automations: [],
  loading: true,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'ADD_BOARD':
      return { ...state, boards: [...state.boards, action.payload] };
    case 'UPDATE_BOARD':
      return { ...state, boards: state.boards.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BOARD':
      return {
        ...state,
        boards: state.boards.filter(b => b.id !== action.payload),
        groups: state.groups.filter(g => g.boardId !== action.payload),
        tasks: state.tasks.filter(t => t.boardId !== action.payload),
        automations: state.automations.filter(a => a.boardId !== action.payload),
      };
    case 'ADD_GROUP':
      return { ...state, groups: [...state.groups, action.payload] };
    case 'UPDATE_GROUP':
      return { ...state, groups: state.groups.map(g => g.id === action.payload.id ? action.payload : g) };
    case 'DELETE_GROUP':
      return {
        ...state,
        groups: state.groups.filter(g => g.id !== action.payload),
        tasks: state.tasks.filter(t => t.groupId !== action.payload),
      };
    case 'TOGGLE_GROUP':
      return { ...state, groups: state.groups.map(g => g.id === action.payload ? { ...g, collapsed: !g.collapsed } : g) };
    case 'ADD_AUTOMATION':
      return { ...state, automations: [...state.automations, action.payload] };
    case 'TOGGLE_AUTOMATION':
      return { ...state, automations: state.automations.map(a => a.id === action.payload ? { ...a, enabled: !a.enabled } : a) };
    case 'DELETE_AUTOMATION':
      return { ...state, automations: state.automations.filter(a => a.id !== action.payload) };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] };
    default:
      return state;
  }
}

// DB <-> App mappers
function dbToBoard(row: any): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    color: row.color,
    updatedAt: row.updated_at?.split('T')[0] || '',
    favorite: row.favorite || false,
  };
}

function dbToGroup(row: any): TaskGroup {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    boardId: row.board_id,
    collapsed: false,
  };
}

function dbToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    assignee: row.assignee || '',
    dueDate: row.due_date || '',
    groupId: row.group_id,
    boardId: row.board_id,
    subtasks: row.subtasks || [],
    attachments: row.attachments || [],
    createdAt: row.created_at?.split('T')[0] || '',
    completedAt: row.completed_at?.split('T')[0] || undefined,
    position: row.position ?? 0,
  };
}

function dbToAutomation(row: any): AutomationRule {
  return {
    id: row.id,
    boardId: row.board_id,
    triggerType: row.trigger_type,
    triggerValue: row.trigger_value,
    actionType: row.action_type,
    actionValue: row.action_value,
    enabled: row.enabled,
    label: row.label || '',
  };
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data from DB
  useEffect(() => {
    const load = async () => {
      const [boardsRes, groupsRes, tasksRes, automationsRes, profilesRes] = await Promise.all([
        supabase.from('boards').select('*').order('created_at'),
        supabase.from('task_groups').select('*').order('position'),
        supabase.from('tasks').select('*').order('position').order('created_at'),
        supabase.from('automation_rules').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const boards = (boardsRes.data || []).map(dbToBoard);
      const groups = (groupsRes.data || []).map(dbToGroup);
      const tasks = (tasksRes.data || []).map(dbToTask);
      const automations = (automationsRes.data || []).map(dbToAutomation);
      const users: User[] = (profilesRes.data || []).map(p => ({
        id: p.user_id,
        name: p.full_name || 'Sem nome',
        email: '',
        avatar: (p.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      }));

      dispatch({ type: 'SET_STATE', payload: { boards, groups, tasks, users, automations, loading: false } });
    };
    load();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          dispatch({ type: 'SET_STATE', payload: { boards: undefined } }); // trigger re-fetch
          refetch('boards');
        } else if (payload.eventType === 'UPDATE') {
          dispatch({ type: 'SET_STATE', payload: { boards: undefined } });
          refetch('boards');
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'SET_STATE', payload: { boards: undefined } });
          refetch('boards');
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_groups' }, () => {
        refetch('groups');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        refetch('tasks');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_rules' }, () => {
        refetch('automations');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refetch = async (type: 'boards' | 'groups' | 'tasks' | 'automations') => {
    switch (type) {
      case 'boards': {
        const { data } = await supabase.from('boards').select('*').order('created_at');
        if (data) dispatch({ type: 'SET_STATE', payload: { boards: data.map(dbToBoard) } });
        break;
      }
      case 'groups': {
        const { data } = await supabase.from('task_groups').select('*').order('position');
        if (data) dispatch({ type: 'SET_STATE', payload: { groups: data.map(dbToGroup) } });
        break;
      }
      case 'tasks': {
        const { data } = await supabase.from('tasks').select('*').order('position').order('created_at');
        if (data) dispatch({ type: 'SET_STATE', payload: { tasks: data.map(dbToTask) } });
        break;
      }
      case 'automations': {
        const { data } = await supabase.from('automation_rules').select('*');
        if (data) dispatch({ type: 'SET_STATE', payload: { automations: data.map(dbToAutomation) } });
        break;
      }
    }
  };

  // DB-syncing dispatch wrapper
  const wrappedDispatch = useCallback((action: Action) => {
    dispatch(action);

    // Persist to DB (fire-and-forget)
    (async () => {
      try {
        switch (action.type) {
          case 'ADD_BOARD': {
            const b = action.payload;
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('boards').insert({
              id: b.id,
              title: b.title,
              description: b.description,
              color: b.color,
              favorite: b.favorite || false,
              created_by: user?.id,
            });
            break;
          }
          case 'UPDATE_BOARD': {
            const b = action.payload;
            await supabase.from('boards').update({
              title: b.title,
              description: b.description,
              color: b.color,
              favorite: b.favorite || false,
            }).eq('id', b.id);
            break;
          }
          case 'DELETE_BOARD':
            await supabase.from('boards').delete().eq('id', action.payload);
            break;

          case 'ADD_GROUP': {
            const g = action.payload;
            await supabase.from('task_groups').insert({
              id: g.id,
              title: g.title,
              color: g.color,
              board_id: g.boardId,
            });
            break;
          }
          case 'UPDATE_GROUP': {
            const g = action.payload;
            await supabase.from('task_groups').update({
              title: g.title,
              color: g.color,
            }).eq('id', g.id);
            break;
          }
          case 'DELETE_GROUP':
            await supabase.from('task_groups').delete().eq('id', action.payload);
            break;

          case 'ADD_TASK': {
            const t = action.payload;
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('tasks').insert({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee || null,
              due_date: t.dueDate || null,
              group_id: t.groupId,
              board_id: t.boardId,
              subtasks: t.subtasks as any,
              attachments: t.attachments as any,
              created_by: user?.id,
              completed_at: t.completedAt || null,
            });
            break;
          }
          case 'UPDATE_TASK': {
            const t = action.payload;
            await supabase.from('tasks').update({
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee || null,
              due_date: t.dueDate || null,
              group_id: t.groupId,
              board_id: t.boardId,
              subtasks: t.subtasks as any,
              attachments: t.attachments as any,
              completed_at: t.completedAt || null,
              position: t.position ?? 0,
            }).eq('id', t.id);
            break;
          }
          case 'DELETE_TASK':
            await supabase.from('tasks').delete().eq('id', action.payload);
            break;

          case 'ADD_AUTOMATION': {
            const a = action.payload;
            await supabase.from('automation_rules').insert({
              id: a.id,
              board_id: a.boardId,
              trigger_type: a.triggerType,
              trigger_value: a.triggerValue,
              action_type: a.actionType,
              action_value: a.actionValue,
              enabled: a.enabled,
              label: a.label,
            });
            break;
          }
          case 'TOGGLE_AUTOMATION': {
            const auto = state.automations.find(a => a.id === action.payload);
            if (auto) {
              await supabase.from('automation_rules').update({ enabled: !auto.enabled }).eq('id', action.payload);
            }
            break;
          }
          case 'DELETE_AUTOMATION':
            await supabase.from('automation_rules').delete().eq('id', action.payload);
            break;
        }
      } catch (err) {
        console.error('DB sync error:', err);
      }
    })();

    // Run automations on task updates
    if (action.type === 'UPDATE_TASK') {
      const task = action.payload;
      const enabledRules = state.automations.filter(a => a.enabled && a.boardId === task.boardId);
      for (const rule of enabledRules) {
        if (rule.triggerType === 'status_change' && task.status === rule.triggerValue) {
          if (rule.actionType === 'move_group') {
            const updated = { ...task, groupId: rule.actionValue };
            dispatch({ type: 'UPDATE_TASK', payload: updated });
            supabase.from('tasks').update({ group_id: rule.actionValue }).eq('id', task.id);
          } else if (rule.actionType === 'change_priority') {
            const updated = { ...task, priority: rule.actionValue as any };
            dispatch({ type: 'UPDATE_TASK', payload: updated });
            supabase.from('tasks').update({ priority: rule.actionValue }).eq('id', task.id);
          }
        }
      }
    }
  }, [state.automations]);

  return (
    <AppContext.Provider value={{ state, dispatch: wrappedDispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
