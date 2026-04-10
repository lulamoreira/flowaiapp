import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  duration_seconds: number;
  description: string;
  entry_type: 'manual' | 'timer';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  user_name?: string;
}

interface ActiveTimer {
  taskId: string;
  startedAt: number; // epoch ms
  accumulated: number; // seconds already saved
}

export function useTimeTracking(taskId?: string) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch entries for a task
  const fetchEntries = useCallback(async (tid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', tid)
      .order('created_at', { ascending: false });

    if (data) {
      // Enrich with user names
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      setEntries(data.map(e => ({
        ...e,
        entry_type: e.entry_type as 'manual' | 'timer',
        user_name: nameMap.get(e.user_id) || 'Desconhecido',
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (taskId) fetchEntries(taskId);
  }, [taskId, fetchEntries]);

  // Timer tick
  useEffect(() => {
    if (activeTimer) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        setElapsed(activeTimer.accumulated + Math.floor((now - activeTimer.startedAt) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer]);

  const startTimer = useCallback((tid: string) => {
    setActiveTimer({ taskId: tid, startedAt: Date.now(), accumulated: 0 });
  }, []);

  const stopTimer = useCallback(async () => {
    if (!activeTimer || !user) return;
    const totalSeconds = Math.floor((Date.now() - activeTimer.startedAt) / 1000) + activeTimer.accumulated;
    if (totalSeconds < 1) {
      setActiveTimer(null);
      return;
    }

    await supabase.from('time_entries').insert({
      task_id: activeTimer.taskId,
      user_id: user.id,
      duration_seconds: totalSeconds,
      entry_type: 'timer',
      started_at: new Date(activeTimer.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
    });

    setActiveTimer(null);
    if (taskId) fetchEntries(taskId);
  }, [activeTimer, user, taskId, fetchEntries]);

  const addManualEntry = useCallback(async (tid: string, durationMinutes: number, description: string) => {
    if (!user || durationMinutes <= 0) return;
    await supabase.from('time_entries').insert({
      task_id: tid,
      user_id: user.id,
      duration_seconds: Math.round(durationMinutes * 60),
      description,
      entry_type: 'manual',
    });
    if (taskId) fetchEntries(taskId);
  }, [user, taskId, fetchEntries]);

  const deleteEntry = useCallback(async (entryId: string) => {
    await supabase.from('time_entries').delete().eq('id', entryId);
    if (taskId) fetchEntries(taskId);
  }, [taskId, fetchEntries]);

  const totalSeconds = entries.reduce((sum, e) => sum + e.duration_seconds, 0);

  return {
    entries,
    loading,
    activeTimer,
    elapsed,
    totalSeconds,
    startTimer,
    stopTimer,
    addManualEntry,
    deleteEntry,
    fetchEntries,
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
