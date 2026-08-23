import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BoardGantt } from '@/components/board/BoardGantt';

export default function PublicTimelinePage() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{groups: any[], tasks: any[]}>({ groups: [], tasks: [] });

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      // @ts-ignore
      const { data: b } = await supabase.from('boards').select('*').eq('public_token', token).eq('public_timeline_enabled', true).maybeSingle();

      if (b) {
        setBoard(b);
        const [gs, ts] = await Promise.all([
          // @ts-ignore
          supabase.from('task_groups').select('*').eq('board_id', b.id),
          // @ts-ignore
          supabase.from('tasks').select('*').eq('board_id', b.id)
        ]);
        setData({
          groups: (gs.data || []).map((g: any) => ({
            id: g.id,
            title: g.title,
            color: g.color,
            boardId: g.board_id,
            collapsed: false
          })),
          tasks: (ts.data || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: t.status,
            priority: t.priority,
            assignee: t.assignee || '',
            plannedStart: t.planned_start,
            plannedEnd: t.planned_end,
            groupId: t.group_id,
            boardId: t.board_id,
            subtasks: t.subtasks || [],
            attachments: t.attachments || [],
            createdAt: t.created_at,
            position: t.position || 0
          }))
        });
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div>Carregando...</div>;
  if (!board) return <div>Não encontrado.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{board.title}</h1>
      <BoardGantt boardId={board.id} tasks={data.tasks} groups={data.groups} />
    </div>
  );
}
