import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BoardGantt } from '@/components/board/BoardGantt';
import { Task, TaskGroup } from '@/types';

export default function PublicTimelinePage() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{groups: TaskGroup[], tasks: Task[]}>({ groups: [], tasks: [] });

  useEffect(() => {
    if (!token) return;
    const loadPublicBoard = async () => {
      // Use any to bypass TS linter for the newly added columns
      const { data: boardData } = await supabase
        .from('boards')
        .select('*')
        .eq('public_token' as any, token)
        .eq('public_timeline_enabled' as any, true)
        .single();

      if (boardData) {
        setBoard(boardData);
        
        const [groupsRes, tasksRes] = await Promise.all([
          supabase.from('task_groups').select('*').eq('board_id', boardData.id).order('position'),
          supabase.from('tasks').select('*').eq('board_id', boardData.id).order('position')
        ]);

        setData({
          groups: (groupsRes.data || []).map(g => ({
            id: g.id,
            title: g.title,
            color: g.color,
            boardId: g.board_id,
            collapsed: false
          })),
          tasks: (tasksRes.data || []).map(t => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: t.status as any,
            priority: t.priority as any,
            assignee: t.assignee || '',
            plannedStart: t.planned_start || undefined,
            plannedEnd: t.planned_end || undefined,
            actualStart: t.actual_start || undefined,
            actualEnd: t.actual_end || undefined,
            groupId: t.group_id,
            boardId: t.board_id,
            subtasks: (t.subtasks as any) || [],
            attachments: (t.attachments as any) || [],
            createdAt: t.created_at || '',
            position: t.position || 0
          }))
        });
      }
      setLoading(false);
    };
    loadPublicBoard();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando Linha do Tempo...</div>;
  if (!board) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Linha do Tempo não encontrada ou privada.</div>;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{board.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">Visualização Pública da Linha do Tempo</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-xs font-bold text-white shadow-lg">
            F
          </div>
        </div>
        <BoardGantt boardId={board.id} tasks={data.tasks} groups={data.groups} />
      </div>
    </div>
  );
}
