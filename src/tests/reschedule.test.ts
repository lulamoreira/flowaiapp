import { describe, it, expect } from 'vitest';
import { calculateReschedule, calculateSmartDateEdit, detectNewConflicts } from '../lib/reschedule';
import { Task } from '../types';
import { isWeekend, parseISO } from 'date-fns';

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Task 1',
    assignee: 'User A',
    plannedStart: '2024-01-01',
    plannedEnd: '2024-01-05',
    status: 'not_started',
    priority: 'medium',
    description: '',
    groupId: 'g1',
    boardId: 'b1',
    subtasks: [],
    attachments: [],
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    title: 'Task 2',
    assignee: 'User A',
    plannedStart: '2024-01-06',
    plannedEnd: '2024-01-10',
    status: 'not_started',
    priority: 'medium',
    description: '',
    groupId: 'g1',
    boardId: 'b1',
    subtasks: [],
    attachments: [],
    createdAt: '2024-01-01'
  },
  {
    id: '3',
    title: 'Task 3',
    assignee: 'User B',
    plannedStart: null,
    plannedEnd: null,
    status: 'not_started',
    priority: 'medium',
    description: '',
    groupId: 'g1',
    boardId: 'b1',
    subtasks: [],
    attachments: [],
    createdAt: '2024-01-01'
  }
];

describe('Reschedule Logic', () => {
  it('should shift dates forward maintaining duration', () => {
    // Project duration: 2024-01-01 to 2024-01-10 = 9 days
    // New Project window: 2024-02-01 to 2024-02-10 = 9 days
    const newStart = new Date(2024, 1, 1); // Feb 1
    const newEnd = new Date(2024, 1, 10); // Feb 10
    
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    expect(results[0].plannedStart).toBe('2024-02-01');
    expect(results[0].plannedEnd).toBe('2024-02-05');
    expect(results[1].plannedStart).toBe('2024-02-06');
    expect(results[1].plannedEnd).toBe('2024-02-10');
  });

  it('should scale dates when duration increases', () => {
    // Project duration: 9 days
    // New duration: 18 days (2024-02-01 to 2024-02-19)
    const newStart = new Date(2024, 1, 1);
    const newEnd = new Date(2024, 1, 19);
    
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    // factor = 18/9 = 2
    // Task 1: offsetStart=0, offsetEnd=4 -> newOffsetStart=0, newOffsetEnd=8 -> 2024-02-01 to 2024-02-09
    // Task 2: offsetStart=5, offsetEnd=9 -> newOffsetStart=10, newOffsetEnd=18 -> 2024-02-11 to 2024-02-19
    expect(results[0].plannedStart).toBe('2024-02-01');
    expect(results[0].plannedEnd).toBe('2024-02-09');
    expect(results[1].plannedStart).toBe('2024-02-11');
    expect(results[1].plannedEnd).toBe('2024-02-19');
  });

  it('should detect new conflicts', () => {
    const proposed = [
      { taskId: '1', plannedStart: '2024-01-01', plannedEnd: '2024-01-08', originalStart: '2024-01-01', originalEnd: '2024-01-05', diffDays: 0 },
      { taskId: '2', plannedStart: '2024-01-05', plannedEnd: '2024-01-12', originalStart: '2024-01-06', originalEnd: '2024-01-10', diffDays: -1 }
    ];

    const conflicts = detectNewConflicts(mockTasks, proposed);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].assignee).toBe('User A');
  });

  it('should scale dates when duration decreases', () => {
    // Project duration: 9 days
    // New duration: 4.5 days -> rounded (2024-02-01 to 2024-02-05 = 4 days)
    const newStart = new Date(2024, 1, 1);
    const newEnd = new Date(2024, 1, 5);
    
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    // factor = 4/9 = 0.444
    // Task 1: offsetStart=0, offsetEnd=4 -> newOffsetStart=0, newOffsetEnd=2 -> 2024-02-01 to 2024-02-03
    // Task 2: offsetStart=5, offsetEnd=9 -> newOffsetStart=2, newOffsetEnd=4 -> 2024-02-03 to 2024-02-05
    expect(results[0].plannedStart).toBe('2024-02-01');
    expect(results[0].plannedEnd).toBe('2024-02-03');
    expect(results[1].plannedStart).toBe('2024-02-03');
    expect(results[1].plannedEnd).toBe('2024-02-05');
  });

  it('should handle tasks without dates', () => {
    const newStart = new Date(2024, 1, 1);
    const newEnd = new Date(2024, 1, 10);
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    const task3 = results.find(r => r.taskId === '3');
    expect(task3?.plannedStart).toBeNull();
    expect(task3?.plannedEnd).toBeNull();
  });

  it('should not report pre-existing conflicts as new', () => {
    // Create a conflict in current state
    const conflictingTasks: Task[] = [
      ...mockTasks,
      {
        ...mockTasks[0],
        id: '4',
        title: 'Conflicting Task',
        plannedStart: '2024-01-02',
        plannedEnd: '2024-01-04'
      }
    ];

    const newStart = new Date(2024, 1, 1);
    const newEnd = new Date(2024, 1, 10);
    const results = calculateReschedule(conflictingTasks, newStart, newEnd);
    
    const newConflicts = detectNewConflicts(conflictingTasks, results);
    
    // Task 1 and Task 4 already conflicted (User A, 01-01/01-05 and 01-02/01-04)
    // They should still conflict in the proposed state, but it's not a NEW conflict
    expect(newConflicts.length).toBe(0);
  });

  it('should throw error when original duration is zero', () => {
    const zeroDurationTasks: Task[] = [
      {
        ...mockTasks[0],
        plannedStart: '2024-01-01',
        plannedEnd: '2024-01-01'
      }
    ];
    
    expect(() => calculateReschedule(zeroDurationTasks, new Date(), new Date())).toThrow('DURATION_ZERO');
  });
});

describe('Smart date edit rescheduling', () => {
  const numberedTasks: Task[] = [
    { ...mockTasks[0], id: '1', taskNumber: 1, plannedStart: '2024-01-01', plannedEnd: '2024-01-03' },
    { ...mockTasks[1], id: '2', taskNumber: 2, plannedStart: '2024-01-04', plannedEnd: '2024-01-06' },
    { ...mockTasks[1], id: '3', taskNumber: 3, title: 'Task 3', plannedStart: '2024-01-07', plannedEnd: '2024-01-10' },
  ];

  it('scales the whole project when the final task changes the project end', () => {
    const result = calculateSmartDateEdit(numberedTasks, '3', { plannedEnd: '2024-01-20' });

    expect(result.strategy).toBe('project-window');
    expect(result.updates).toEqual([
      { taskId: '1', plannedStart: '2024-01-01', plannedEnd: '2024-01-05' },
      { taskId: '2', plannedStart: '2024-01-07', plannedEnd: '2024-01-12' },
      { taskId: '3', plannedStart: '2024-01-07', plannedEnd: '2024-01-20' },
    ]);
  });

  it('keeps a final task on the typed day when moving its start beyond its old end', () => {
    const result = calculateSmartDateEdit(numberedTasks, '3', { plannedStart: '2024-01-20' });

    expect(result.strategy).toBe('project-window');
    expect(result.updates.find(update => update.taskId === '3')).toEqual({
      taskId: '3',
      plannedStart: '2024-01-20',
      plannedEnd: '2024-01-20',
    });
    expect(result.updates.filter(update => update.taskId !== '3').length).toBeGreaterThan(0);
  });

  it('shifts later tasks by task number when an internal task date changes', () => {
    const result = calculateSmartDateEdit(numberedTasks, '2', { plannedEnd: '2024-01-09' });

    expect(result.strategy).toBe('sequence');
    expect(result.updates).toEqual([
      { taskId: '2', plannedStart: '2024-01-04', plannedEnd: '2024-01-09' },
      { taskId: '3', plannedStart: '2024-01-10', plannedEnd: '2024-01-13' },
    ]);
  });

  it('propaga o atraso e sugere a entrega quando a última tarefa está sem data', () => {
    const openEnd: Task[] = [
      { ...mockTasks[0], id: '1', taskNumber: 1, plannedStart: '2024-01-01', plannedEnd: '2024-01-03' },
      { ...mockTasks[1], id: '2', taskNumber: 2, plannedStart: '2024-01-04', plannedEnd: '2024-01-06' },
      { ...mockTasks[1], id: '3', taskNumber: 3, title: 'Entrega', plannedStart: undefined, plannedEnd: undefined },
    ];

    // Etapa 1 atrasa 4 dias (começa 05 e termina 08).
    const result = calculateSmartDateEdit(openEnd, '1', { plannedEnd: '2024-01-07' });

    expect(result.strategy).toBe('sequence');
    expect(result.suggestedOpenEnd).toBe(true);
    expect(result.updates).toEqual([
      { taskId: '1', plannedStart: '2024-01-01', plannedEnd: '2024-01-07' },
      { taskId: '2', plannedStart: '2024-01-08', plannedEnd: '2024-01-10' },
      { taskId: '3', plannedStart: '2024-01-11', plannedEnd: '2024-01-11' },
    ]);
  });

  it('mantém tarefa anterior antes de uma tarefa posterior travada', () => {
    const tasksWithLockedAnchor: Task[] = [
      { ...mockTasks[0], id: '11', taskNumber: 11, title: 'Etapa anterior', plannedStart: '2024-09-10', plannedEnd: '2024-09-12' },
      { ...mockTasks[1], id: '12', taskNumber: 12, title: 'Transporte', plannedStart: '2024-09-13', plannedEnd: '2024-09-14' },
      { ...mockTasks[1], id: '13', taskNumber: 13, title: 'Instalação', plannedStart: '2024-09-19', plannedEnd: '2024-09-23', scheduleLocked: true },
      { ...mockTasks[1], id: '14', taskNumber: 14, title: 'Inauguração', plannedStart: '2024-09-24', plannedEnd: '2024-09-24' },
    ];

    const result = calculateSmartDateEdit(tasksWithLockedAnchor, '11', { plannedEnd: '2024-09-20' });
    const transport = result.updates.find(update => update.taskId === '12');
    const locked = result.updates.find(update => update.taskId === '13');

    expect(locked).toBeUndefined();
    expect(transport).toEqual({
      taskId: '12',
      plannedStart: '2024-09-17',
      plannedEnd: '2024-09-18',
    });
  });

  it('mantém tarefa posterior depois de uma tarefa anterior travada', () => {
    const tasksWithLockedAnchor: Task[] = [
      { ...mockTasks[0], id: '1', taskNumber: 1, title: 'Fundação', plannedStart: '2024-09-10', plannedEnd: '2024-09-12', scheduleLocked: true },
      { ...mockTasks[1], id: '2', taskNumber: 2, title: 'Montagem', plannedStart: '2024-09-13', plannedEnd: '2024-09-14' },
      { ...mockTasks[1], id: '3', taskNumber: 3, title: 'Entrega', plannedStart: '2024-09-15', plannedEnd: '2024-09-16' },
    ];

    const result = calculateSmartDateEdit(tasksWithLockedAnchor, '3', { plannedStart: '2024-09-11', plannedEnd: '2024-09-12' });
    const moved = result.updates.find(update => update.taskId === '3');

    expect(result.updates.find(update => update.taskId === '1')).toBeUndefined();
    expect(moved).toEqual({
      taskId: '3',
      plannedStart: '2024-09-13',
      plannedEnd: '2024-09-14',
    });
  });
});


describe('Reschedule: locked tasks and business days', () => {
  it('keeps locked task dates untouched', () => {
    const locked: Task[] = [
      { ...mockTasks[0], scheduleLocked: true },
      mockTasks[1],
    ];
    const results = calculateReschedule(locked, new Date(2024, 1, 1), new Date(2024, 1, 10));
    const t1 = results.find(r => r.taskId === '1')!;
    expect(t1.locked).toBe(true);
    expect(t1.plannedStart).toBe('2024-01-01');
    expect(t1.plannedEnd).toBe('2024-01-05');
    expect(t1.diffDays).toBe(0);
    // Unlocked task still moves
    expect(results.find(r => r.taskId === '2')!.plannedStart).not.toBe('2024-01-06');
  });

  it('never lands on weekends in business-days mode', () => {
    const results = calculateReschedule(
      mockTasks,
      new Date(2024, 1, 1),
      new Date(2024, 1, 23),
      { businessDays: true }
    );
    for (const r of results) {
      if (!r.plannedStart || !r.plannedEnd) continue;
      expect(isWeekend(parseISO(r.plannedStart))).toBe(false);
      expect(isWeekend(parseISO(r.plannedEnd))).toBe(false);
    }
  });

  it('reports non-zero diffDays when dates change with time components', () => {
    const timed: Task[] = [
      { ...mockTasks[0], plannedStart: '2024-01-01T14:00:00+00:00', plannedEnd: '2024-01-05T14:00:00+00:00' },
      { ...mockTasks[1], plannedStart: '2024-01-06T14:00:00+00:00', plannedEnd: '2024-01-10T14:00:00+00:00' },
    ];
    const results = calculateReschedule(timed, new Date(2024, 1, 1), new Date(2024, 1, 10));
    expect(results[0].diffDays).not.toBe(0);
    expect(results[1].diffDays).not.toBe(0);
  });
});
