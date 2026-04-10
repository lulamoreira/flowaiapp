export type TaskStatus = 'not_started' | 'working' | 'stuck' | 'done' | 'waiting';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  addedAt: string;
  url?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  groupId: string;
  boardId: string;
  subtasks: Subtask[];
  attachments: Attachment[];
  createdAt: string;
  completedAt?: string;
}

export interface TaskGroup {
  id: string;
  title: string;
  color: string;
  boardId: string;
  collapsed?: boolean;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: string;
  favorite?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: 'status_change' | 'date_passed';
  triggerValue: string;
  actionType: 'move_group' | 'change_priority' | 'change_status';
  actionValue: string;
  enabled: boolean;
  label: string;
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Não Iniciado', color: '#c4c4c4', bg: '#f0f0f0' },
  working: { label: 'Trabalhando', color: '#fdab3d', bg: '#fff3e0' },
  stuck: { label: 'Travado', color: '#e2445c', bg: '#fce4ec' },
  done: { label: 'Concluído', color: '#00c875', bg: '#e8f5e9' },
  waiting: { label: 'Aguardando', color: '#a25ddc', bg: '#f3e5f5' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Crítico', color: '#333333', bg: '#e0e0e0' },
  high: { label: 'Alto', color: '#401694', bg: '#ede7f6' },
  medium: { label: 'Médio', color: '#5559df', bg: '#e8eaf6' },
  low: { label: 'Baixo', color: '#579bfc', bg: '#e3f2fd' },
  none: { label: 'Nenhum', color: '#c4c4c4', bg: '#f5f5f5' },
};
