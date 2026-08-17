import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BoardGantt } from '@/components/board/BoardGantt';

// Mock hook to bypass recursion
function useSimpleDispatch() {
  try {
    const context = (window as any).AppContext; // Accessing indirectly if possible or using a simplified fetch
    // If we can't get the real one, we just fetch locally
    return null;
  } catch(e) {
    return null;
  }
}

export default function PublicTimelinePage() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{groups: any[], tasks: any[]}>({ groups: [], tasks: [] });

  useEffect(() => {
    if (!token) return;
    const loadPublicBoard = async () => {
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
          groups: groupsRes.data || [],
          tasks: tasksRes.data || []
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{board.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualização Pública da Linha do Tempo</p>
        </div>
        {/* We use a simplified wrapper or inject data if BoardGantt supported it */}
        {/* For now, just a placeholder to check build */}
        <div className="p-4 bg-card rounded border">Linha do Tempo de {board.title}</div>
      </div>
    </div>
  );
}
