import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { Board, TaskGroup, Task, User, AutomationRule } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';

interface AppState {
  boards: Board[];
  groups: TaskGroup[];
  tasks: Task[];
  users: User[];
  projectMembers: Record<string, string[]>; // boardId -> userId[]
  automations: AutomationRule[];
  loading: boolean;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string; confirmDetails?: { title: string; type: string } }
  | { type: 'ADD_BOARD'; payload: Board }
  | { type: 'UPDATE_BOARD'; payload: Board }
  | { type: 'DELETE_BOARD'; payload: string; confirmDetails?: { title: string; type: string } }
  | { type: 'ADD_GROUP'; payload: TaskGroup }
  | { type: 'UPDATE_GROUP'; payload: TaskGroup }
  | { type: 'DELETE_GROUP'; payload: string; confirmDetails?: { title: string; type: string } }
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
  projectMembers: {},
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
    status: row.status || 'not_started',
    priority: row.priority || 'none',

    assignee: row.assignee || '',
    plannedStart: row.planned_start || null,
    plannedEnd: row.planned_end || null,
    actualStart: row.actual_start || null,
    actualEnd: row.actual_end || null,
    groupId: row.group_id,
    boardId: row.board_id,
    subtasks: row.subtasks || [],
    attachments: row.attachments || [],
    createdAt: row.created_at?.split('T')[0] || '',
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

async function fetchPaginated(table: string, orderCol: string = 'created_at') {
  let allData: any[] = [];
  let from = 0;
  let to = 999;
  let hasMore = true;

  while (hasMore) {
    const response = await (supabase
      .from(table as any) as any)
      .select('*', { count: 'exact' })
      .order(orderCol)
      .range(from, to);
    
    const { data, error, count } = response;

    if (error) throw error;
    if (data) allData = [...allData, ...data];
    
    if (count !== null && allData.length >= count) {
      hasMore = false;
    } else if (data.length < 1000) {
      hasMore = false;
    } else {
      from += 1000;
      to += 1000;
    }
  }
  return allData;
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: rolesData } = currentUser 
        ? await supabase.from('user_roles').select('role').eq('user_id', currentUser.id)
        : { data: [] };
      
      const roles = rolesData?.map(r => r.role) || [];
      const isPrivileged = roles.includes('admin') || roles.includes('owner') || roles.includes('coordinator');

      const [boardsData, groupsData, tasksData, automationsData, profilesData, placeholdersData, membersData] = await Promise.all([
        fetchPaginated('boards', 'created_at'),
        fetchPaginated('task_groups', 'position'),
        fetchPaginated('tasks', 'position'),
        fetchPaginated('automation_rules', 'created_at'),
        fetchPaginated('profiles', 'created_at'),
        fetchPaginated('placeholder_members', 'created_at'),
        fetchPaginated('project_members', 'created_at'),
      ]);

      const groups = groupsData.map(dbToGroup);
      const tasks = tasksData.map(dbToTask);
      const automations = automationsData.map(dbToAutomation);
      
      const projectMembers: Record<string, string[]> = {};
      membersData.forEach((m: any) => {
        if (!projectMembers[m.board_id]) projectMembers[m.board_id] = [];
        projectMembers[m.board_id].push(m.user_id);
      });

      // NO FILTRATION IN STORE: the RLS handles what the user can select, 
      // and we want all LOADED boards to be visible in state.
      const boards = boardsData.map(dbToBoard);

      const realUsers: User[] = profilesData.map(p => ({
        id: p.user_id,
        name: p.full_name || 'Sem nome',
        email: p.email || '',
        avatar: (p.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      }));
      const placeholders: User[] = placeholdersData.map(p => ({
        id: p.id,
        name: p.full_name + (p.claimed_by ? '' : ' (provisório)'),
        email: p.email || '',
        avatar: (p.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        isPlaceholder: true,
      }));
      const users = [...realUsers, ...placeholders];
      
      dispatch({ type: 'SET_STATE', payload: { boards, groups, tasks, users, automations, projectMembers, loading: false } });
    } catch (err: any) {
      console.error('Error loading data:', err);
      toast.error('Erro ao carregar dados: ' + err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refetch = async (type: 'boards' | 'groups' | 'tasks' | 'automations' | 'users' | 'projectMembers') => {
    try {
      switch (type) {
        case 'boards': {
          const data = await fetchPaginated('boards', 'created_at');
          dispatch({ type: 'SET_STATE', payload: { boards: data.map(dbToBoard) } });
          break;
        }
        case 'groups': {
          const data = await fetchPaginated('task_groups', 'position');
          dispatch({ type: 'SET_STATE', payload: { groups: data.map(dbToGroup) } });
          break;
        }
        case 'tasks': {
          const data = await fetchPaginated('tasks', 'position');
          dispatch({ type: 'SET_STATE', payload: { tasks: data.map(dbToTask) } });
          break;
        }
        case 'automations': {
          const data = await fetchPaginated('automation_rules', 'created_at');
          dispatch({ type: 'SET_STATE', payload: { automations: data.map(dbToAutomation) } });
          break;
        }
        case 'users': {
          const [profilesData, placeholdersData] = await Promise.all([
            fetchPaginated('profiles', 'created_at'),
            fetchPaginated('placeholder_members', 'created_at'),
          ]);
          const realUsers: User[] = profilesData.map(p => ({
            id: p.user_id,
            name: p.full_name || 'Sem nome',
            email: p.email || '',
            avatar: (p.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          }));
          const placeholders: User[] = placeholdersData.map(p => ({
            id: p.id,
            name: p.full_name + (p.claimed_by ? '' : ' (provisório)'),
            email: p.email || '',
            avatar: (p.full_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
            isPlaceholder: true,
          }));
          dispatch({ type: 'SET_STATE', payload: { users: [...realUsers, ...placeholders] } });
          break;
        }
        case 'projectMembers': {
          const data = await fetchPaginated('project_members', 'created_at');
          const projectMembers: Record<string, string[]> = {};
          data.forEach((m: any) => {
            if (!projectMembers[m.board_id]) projectMembers[m.board_id] = [];
            projectMembers[m.board_id].push(m.user_id);
          });
          dispatch({ type: 'SET_STATE', payload: { projectMembers } });
          break;
        }
      }
    } catch (err: any) {
      console.error(`Refetch error (${type}):`, err);
      toast.error(`Erro ao atualizar ${type}: ` + err.message);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => refetch('boards'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_groups' }, () => refetch('groups'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refetch('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_rules' }, () => refetch('automations'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetch('users'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'placeholder_members' }, () => refetch('users'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
        refetch('projectMembers');
        refetch('boards');
      })
    const handleFocus = () => {
      refetch('users');
      refetch('projectMembers');
      refetch('boards');
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const [confirmDelete, setConfirmDelete] = React.useState<{
    type: 'DELETE_TASK' | 'DELETE_BOARD' | 'DELETE_GROUP';
    payload: string;
    title: string;
    itemType: string;
    details?: any;
  } | null>(null);

  const wrappedDispatch = useCallback((action: Action) => {
    // Intercept delete actions for confirmation
    if ((action.type === 'DELETE_TASK' || action.type === 'DELETE_BOARD' || action.type === 'DELETE_GROUP') && (action as any).confirmDetails) {
      const details = (action as any).confirmDetails;
      let itemDetails = undefined;
      
      if (action.type === 'DELETE_TASK') {
        const task = state.tasks.find(t => t.id === action.payload);
        if (task) {
          itemDetails = {
            id: task.id,
            status: task.status,
            prioridade: task.priority
          };
        }
      } else if (action.type === 'DELETE_GROUP') {
        const group = state.groups.find(g => g.id === action.payload);
        if (group) {
          itemDetails = {
            id: group.id,
            tarefas: state.tasks.filter(t => t.groupId === group.id).length
          };
        }
      }
      
      setConfirmDelete({
        type: action.type,
        payload: action.payload,
        title: details.title,
        itemType: details.type,
        details: itemDetails
      });
      return;
    }

    dispatch(action);

    // If it's a delete action that was ALREADY confirmed (doesn't have confirmDetails)
    // we let it proceed to the database sync below.
    // If it has confirmDetails, we already returned early above.

    (async () => {
      try {
        let error = null;
        const { data: { user } } = await supabase.auth.getUser();

        switch (action.type) {
          case 'ADD_BOARD': {
            const b = action.payload;
            const res = await supabase.from('boards').insert({
              id: b.id,
              title: b.title,
              description: b.description,
              color: b.color,
              favorite: b.favorite || false,
              created_by: user?.id,
            });
            error = res.error;
            logActivity('Criou quadro', { board: b.title });
            break;
          }
          case 'UPDATE_BOARD': {
            const b = action.payload;
            const res = await supabase.from('boards').update({
              title: b.title,
              description: b.description,
              color: b.color,
              favorite: b.favorite || false,
            }).eq('id', b.id);
            error = res.error;
            break;
          }
          case 'DELETE_BOARD': {
            const boardId = action.payload;
            const boardToDelete = state.boards.find(b => b.id === boardId);
            if (boardToDelete) {
              const groupsToLog = state.groups.filter(g => g.boardId === boardId);
              const tasksToLog = state.tasks.filter(t => t.boardId === boardId);
              
              const logs = [
                {
                  table_name: 'boards',
                  original_id: boardId,
                  data: boardToDelete as any,
                  deleted_by: user?.id,
                  board_id: boardId,
                  confirm_details: (action as any).confirmDetails || null,
                },
                ...groupsToLog.map(g => ({
                  table_name: 'task_groups',
                  original_id: g.id,
                  data: g as any,
                  deleted_by: user?.id,
                  board_id: boardId,
                })),
                ...tasksToLog.map(t => ({
                  table_name: 'tasks',
                  original_id: t.id,
                  data: t as any,
                  deleted_by: user?.id,
                  board_id: boardId,
                }))
              ];

              const { error: logError } = await (supabase.from('deletion_log') as any).insert(logs);
              if (logError) console.error('Error logging board deletion:', logError);
            }
            const res = await supabase.from('boards').delete().eq('id', boardId);
            error = res.error;
            logActivity('Excluiu quadro', { boardId: boardId });
            break;
          }
          case 'ADD_GROUP': {
            const g = action.payload;
            const res = await supabase.from('task_groups').insert({
              id: g.id,
              title: g.title,
              color: g.color,
              board_id: g.boardId,
            });
            error = res.error;
            break;
          }
          case 'UPDATE_GROUP': {
            const g = action.payload;
            const res = await supabase.from('task_groups').update({
              title: g.title,
              color: g.color,
            }).eq('id', g.id);
            error = res.error;
            break;
          }
          case 'DELETE_GROUP': {
            const groupId = action.payload;
            const groupToDelete = state.groups.find(g => g.id === groupId);
            if (groupToDelete) {
              const tasksToLog = state.tasks.filter(t => t.groupId === groupId);
              
              const logs = [
                {
                  table_name: 'task_groups',
                  original_id: groupId,
                  data: groupToDelete as any,
                  deleted_by: user?.id,
                  board_id: groupToDelete.boardId,
                  confirm_details: (action as any).confirmDetails || null,
                },
                ...tasksToLog.map(t => ({
                  table_name: 'tasks',
                  original_id: t.id,
                  data: t as any,
                  deleted_by: user?.id,
                  board_id: groupToDelete.boardId,
                }))
              ];

              const { error: logError } = await (supabase.from('deletion_log') as any).insert(logs);
              if (logError) console.error('Error logging group deletion:', logError);
            }
            const res = await supabase.from('task_groups').delete().eq('id', groupId);
            error = res.error;
            break;
          }
          case 'ADD_TASK': {
            const t = action.payload;
            const { data: { user } } = await supabase.auth.getUser();
            const res = await supabase.from('tasks').insert({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee || null,
              planned_start: t.plannedStart || null,
              planned_end: t.plannedEnd || null,
              actual_start: t.actualStart || null,
              actual_end: t.actualEnd || null,
              group_id: t.groupId,
              board_id: t.boardId,
              subtasks: t.subtasks as any,
              attachments: t.attachments as any,
              position: t.position ?? 0,
              created_by: user?.id,
            });
            error = res.error;
            logActivity('Criou tarefa', { task: t.title });
            break;
          }
          case 'UPDATE_TASK': {
            const t = action.payload;
            const oldTask = state.tasks.find(tk => tk.id === t.id);
            const res = await supabase.from('tasks').update({
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignee: t.assignee || null,
              planned_start: t.plannedStart || null,
              planned_end: t.plannedEnd || null,
              actual_start: t.actualStart || null,
              actual_end: t.actualEnd || null,
              group_id: t.groupId,
              board_id: t.boardId,
              subtasks: t.subtasks as any,
              attachments: t.attachments as any,
              position: t.position ?? 0,
            }).eq('id', t.id);
            error = res.error;
            if (oldTask && oldTask.status !== t.status) {
              logActivity('Alterou status de tarefa', { task: t.title, from: oldTask.status, to: t.status });
            }
            break;
          }
          case 'DELETE_TASK': {
            const taskId = action.payload;
            const taskToDelete = state.tasks.find(t => t.id === taskId);
            if (taskToDelete) {
              await (supabase.from('deletion_log') as any).insert({
                table_name: 'tasks',
                original_id: taskId,
                data: taskToDelete as any,
                deleted_by: user?.id,
                board_id: taskToDelete.boardId,
                confirm_details: (action as any).confirmDetails || null,
              });
            }
            const res = await supabase.from('tasks').delete().eq('id', taskId);
            error = res.error;
            logActivity('Excluiu tarefa', { taskId: taskId });
            break;
          }
          case 'ADD_AUTOMATION': {
            const a = action.payload;
            const res = await supabase.from('automation_rules').insert({
              id: a.id,
              board_id: a.boardId,
              trigger_type: a.triggerType,
              trigger_value: a.triggerValue,
              action_type: a.actionType,
              action_value: a.actionValue,
              enabled: a.enabled,
              label: a.label,
            });
            error = res.error;
            break;
          }
        }
        if (error) {
          console.error('DB sync error:', error);
          toast.error('Erro ao salvar no banco: ' + error.message);
        }
      } catch (err: any) {
        console.error('DB sync error:', err);
        toast.error('A alteração não foi salva: ' + err.message);
      }
    })();

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
  }, [state.automations, state.tasks]);

  return (
    <AppContext.Provider value={{ state, dispatch: wrappedDispatch }}>
      {children}
      <DeleteConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            dispatch({ type: confirmDelete.type, payload: confirmDelete.payload } as Action);
            toast.success(`${confirmDelete.itemType} excluído`);
            setConfirmDelete(null);
          }
        }}
        title={`Excluir ${confirmDelete?.itemType}`}
        description={`Você tem certeza que deseja excluir este ${confirmDelete?.itemType?.toLowerCase()}? Ele será movido para a lixeira por 24 horas.`}
        itemName={confirmDelete?.title}
        itemDetails={confirmDelete?.details}
      />
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
