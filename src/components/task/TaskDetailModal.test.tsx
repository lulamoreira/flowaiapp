import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDetailModal } from './TaskDetailModal';
import { Task, TaskStatus, TaskPriority } from '@/types';

// Mock auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' } }),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      delete: vi.fn(() => ({ data: null, error: null })),
    })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(() => ({ data: null, error: null })), getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })) })) },
  },
}));

// Mock store
const mockDispatch = vi.fn();
const mockState = {
  boards: [],
  groups: [],
  tasks: [],
  users: [],
  projectMembers: {},
  automations: [],
  loading: false,
};
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ state: mockState, dispatch: mockDispatch }),
}));

// Mock sub-components
vi.mock('@/components/task/TaskComments', () => ({
  TaskComments: () => <div data-testid="task-comments" />,
}));
vi.mock('@/components/task/TaskTimeTracking', () => ({
  TaskTimeTracking: () => <div data-testid="task-time-tracking" />,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function createTask(title: string, isNew = false): Task {
  return {
    id: 'task-1',
    boardId: 'board-1',
    groupId: 'group-1',
    title,
    description: '',
    assignee: '',
    status: 'not_started' as TaskStatus,
    priority: 'none' as TaskPriority,
    plannedStart: undefined,
    plannedEnd: undefined,
    actualStart: undefined,
    actualEnd: undefined,
    position: 0,
    taskNumber: isNew ? 1 : 2,
    createdAt: new Date().toISOString(),
    subtasks: [],
    attachments: [],
  };
}

describe('TaskDetailModal title field', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('does not focus the title on open', async () => {
    const task = createTask('Título existente');
    render(<TaskDetailModal task={task} onClose={() => {}} />);

    const input = await screen.findByPlaceholderText('Nome da tarefa') as HTMLTextAreaElement;
    await new Promise(r => setTimeout(r, 150));
    expect(document.activeElement).not.toBe(input);
    expect(input).toHaveAttribute('readonly');
  });

  it('clears the placeholder title for new tasks', async () => {
    const task = createTask('Nova tarefa', true);
    render(<TaskDetailModal task={task} onClose={() => {}} />);

    const input = await screen.findByPlaceholderText('Nome da tarefa') as HTMLTextAreaElement;
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('has large, bold title styling classes', async () => {
    const task = createTask('Título estilizado');
    render(<TaskDetailModal task={task} onClose={() => {}} />);

    const input = await screen.findByPlaceholderText('Nome da tarefa');
    expect(input.className).toContain('text-2xl');
    expect(input.className).toContain('font-bold');
    expect(input.className).toContain('text-foreground');
  });

  it('discards edits on Escape', async () => {
    const task = createTask('Título original');
    const onClose = vi.fn();
    render(<TaskDetailModal task={task} onClose={onClose} />);

    const input = await screen.findByPlaceholderText('Nome da tarefa') as HTMLTextAreaElement;
    fireEvent.click(input);
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.change(input, { target: { value: 'Título editado' } });
    expect(input.value).toBe('Título editado');

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(input.value).toBe('Título original');
    // Escape should not close the modal
    expect(onClose).not.toHaveBeenCalled();
  });

  it('commits on Enter', async () => {
    const task = createTask('Título original');
    render(<TaskDetailModal task={task} onClose={() => {}} />);

    const input = await screen.findByPlaceholderText('Nome da tarefa') as HTMLTextAreaElement;
    fireEvent.click(input);
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.change(input, { target: { value: 'Título confirmado' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'UPDATE_TASK',
        payload: expect.objectContaining({ title: 'Título confirmado' }),
      }));
    });
  });
});
