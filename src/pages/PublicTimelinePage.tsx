import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BoardGantt } from '@/components/board/BoardGantt';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';

export default function PublicTimelinePage() {
  const { token } = useParams<{ token: string }>();
  const { dispatch } = useAppStore();
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const loadPublicBoard = async () => {
      // Fetch board by token
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('public_token' as any, token)
        .eq('public_timeline_enabled' as any, true)
        .single();

      if (boardData) {
        setBoard(boardData);
        
        // Fetch groups and tasks for this board
        const [groupsRes, tasksRes] = await Promise.all([
          supabase.from('task_groups').select('*').eq('board_id', boardData.id).order('position'),
          supabase.from('tasks').select('*').eq('board_id', boardData.id).order('position')
        ]);

        // Inject into AppStore so BoardGantt can use them
        // Note: We might need a special action for public data or just SET_STATE
        // Since it's public read-only, we just need the UI to render.
        dispatch({ 
          type: 'SET_STATE', 
          payload: { 
            boards: [boardData as any],
            groups: (groupsRes.data || []) as any,
            tasks: (tasksRes.data || []) as any,
            loading: false
          } 
        });
      }
      setLoading(false);
    };
    loadPublicBoard();
  }, [token, dispatch]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando Linha do Tempo...</div>;
  if (!board) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Linha do Tempo não encontrada ou privada.</div>;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{board.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualização Pública da Linha do Tempo</p>
        </div>
        <BoardGantt boardId={board.id} />
      </div>
    </div>
  );
}
