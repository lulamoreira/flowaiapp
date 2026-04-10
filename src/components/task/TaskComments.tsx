import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const { state } = useAppStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: user.id,
      content: newComment.trim(),
    });
    setNewComment('');
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('task_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const getUserInfo = (userId: string) => {
    const u = state.users.find(u => u.id === userId);
    return {
      name: u?.name || 'Usuário',
      avatar: u?.avatar || '??',
    };
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">
        Comentários ({comments.length})
      </label>

      <div className="max-h-[200px] overflow-y-auto space-y-3 mb-3">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum comentário ainda</p>
        )}
        {comments.map(comment => {
          const author = getUserInfo(comment.user_id);
          const isOwn = comment.user_id === user?.id;
          return (
            <div key={comment.id} className="group flex gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {author.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{author.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[36px] max-h-[80px] text-sm resize-none"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!newComment.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
