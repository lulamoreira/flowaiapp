import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { Board, TaskGroup, Task, User, AutomationRule } from '@/types';
import { mockBoards, mockGroups, mockTasks, mockUsers, mockAutomations } from '@/data/mockData';

interface AppState {
  boards: Board[];
  groups: TaskGroup[];
  tasks: Task[];
  users: User[];
  automations: AutomationRule[];
}

type Action =
  | { type: 'SET_STATE'; payload: AppState }
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
  boards: mockBoards,
  groups: mockGroups,
  tasks: mockTasks,
  users: mockUsers,
  automations: mockAutomations,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
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

const STORAGE_KEY = 'flowai-state';

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return initialState;
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Run automations on task updates
  const wrappedDispatch = useCallback((action: Action) => {
    dispatch(action);
    if (action.type === 'UPDATE_TASK') {
      const task = action.payload;
      const enabledRules = state.automations.filter(a => a.enabled && a.boardId === task.boardId);
      for (const rule of enabledRules) {
        if (rule.triggerType === 'status_change' && task.status === rule.triggerValue) {
          if (rule.actionType === 'move_group') {
            dispatch({ type: 'UPDATE_TASK', payload: { ...task, groupId: rule.actionValue } });
          } else if (rule.actionType === 'change_priority') {
            dispatch({ type: 'UPDATE_TASK', payload: { ...task, priority: rule.actionValue as any } });
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
