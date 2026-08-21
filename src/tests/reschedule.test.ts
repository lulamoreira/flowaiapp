import { describe, it, expect } from 'vitest';
import { calculateReschedule, detectNewConflicts } from '../lib/reschedule';
import { Task } from '../types';

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
  }
];

describe('Reschedule Logic', () => {
  it('should shift dates forward maintaining duration', () => {
    const newStart = new Date('2024-02-01T00:00:00');
    const newEnd = new Date('2024-02-10T00:00:00'); // Same 9 day duration (1st to 10th)
    
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    expect(results[0].plannedStart).toBe('2024-02-01');
    expect(results[0].plannedEnd).toBe('2024-02-05');
    expect(results[1].plannedStart).toBe('2024-02-06');
    expect(results[1].plannedEnd).toBe('2024-02-10');
  });

  it('should scale dates when duration increases', () => {
    const newStart = new Date('2024-02-01T00:00:00');
    const newEnd = new Date('2024-02-19T00:00:00'); // Double duration (18 days instead of 9)
    
    const results = calculateReschedule(mockTasks, newStart, newEnd);
    
    // Original: 1-5 (4 days gap), 6-10 (4 days gap)
    // Double: 1-9 (8 days gap), 11-19 (8 days gap)
    expect(results[0].plannedStart).toBe('2024-02-01');
    expect(results[0].plannedEnd).toBe('2024-02-09');
    expect(results[1].plannedStart).toBe('2024-02-11');
    expect(results[1].plannedEnd).toBe('2024-02-19');
  });

  it('should detect new conflicts', () => {
    // Current state: Task 1 (1-5), Task 2 (6-10) -> No conflict
    
    // Propose: Task 1 (1-8), Task 2 (5-12) -> Overlap between 5 and 8
    const proposed = [
      { taskId: '1', plannedStart: '2024-01-01', plannedEnd: '2024-01-08', originalStart: '2024-01-01', originalEnd: '2024-01-05', diffDays: 0 },
      { taskId: '2', plannedStart: '2024-01-05', plannedEnd: '2024-01-12', originalStart: '2024-01-06', originalEnd: '2024-01-10', diffDays: -1 }
    ];

    const conflicts = detectNewConflicts(mockTasks, proposed);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].assignee).toBe('User A');
  });

  it('should NOT report pre-existing conflicts', () => {
    const preConflictTasks = [
      { ...mockTasks[0], plannedEnd: '2024-01-07' }, // 1 to 7
      { ...mockTasks[1], plannedStart: '2024-01-06' } // 6 to 10 -> Pre-existing overlap
    ];

    const proposed = [
      { taskId: '1', plannedStart: '2024-02-01', plannedEnd: '2024-02-07', originalStart: '2024-01-01', originalEnd: '2024-01-07', diffDays: 31 },
      { taskId: '2', plannedStart: '2024-02-06', plannedEnd: '2024-02-10', originalStart: '2024-01-06', originalEnd: '2024-01-10', diffDays: 31 }
    ];

    const conflicts = detectNewConflicts(preConflictTasks, proposed);
    expect(conflicts).toHaveLength(0); // Conflict already existed
  });
});
