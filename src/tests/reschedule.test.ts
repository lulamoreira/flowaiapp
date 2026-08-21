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
});
