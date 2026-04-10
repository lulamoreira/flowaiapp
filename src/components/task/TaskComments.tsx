import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createNotification } from '@/lib/notifications';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const mentionStartRef = useRef<number | null>(null);

  const filteredUsers = mentionQuery !== null
    ? state.users.filter(u =>
        u.id !== user?.id &&
        u.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : [];

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

  const parseMentions = (text: string): string[] => {
    const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      ids.push(match[2]);
    }
    return ids;
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(@\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <span key={i} className="text-primary font-medium">@{match[1]}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);

    await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: user.id,
      content: newComment.trim(),
    });

    // Send notifications to mentioned users
    const mentionedIds = parseMentions(newComment);
    const senderName = state.users.find(u => u.id === user.id)?.name || 'Alguém';
    for (const uid of mentionedIds) {
      if (uid !== user.id) {
        await createNotification({
          userId: uid,
          title: 'Você foi mencionado',
          message: `${senderName} mencionou você em um comentário.`,
          link: `/board?task=${taskId}`,
        });
      }
    }

    setNewComment('');
    setSending(false);
    closeMention();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('task_comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const getUserInfo = (userId: string) => {
    const u = state.users.find(u => u.id === userId);
    return { name: u?.name || 'Usuário', avatar: u?.avatar || '??' };
  };

  const closeMention = () => {
    setMentionQuery(null);
    setMentionIndex(0);
    setMentionPos(null);
    mentionStartRef.current = null;
  };

  const insertMention = useCallback((selectedUser: { id: string; name: string }) => {
    const start = mentionStartRef.current;
    if (start === null) return;
    const before = newComment.slice(0, start);
    const after = newComment.slice(textareaRef.current?.selectionStart || start);
    // Remove the partial @query from "after"
    const afterClean = after.replace(/^[^\s]*/, '');
    const mention = `@[${selectedUser.name}](${selectedUser.id}) `;
    setNewComment(before + mention + afterClean);
    closeMention();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [newComment]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      mentionStartRef.current = cursorPos - atMatch[0].length;
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      // Position popup near textarea
      setMentionPos({ top: -filteredUsers.length * 32 - 8, left: 0 });
    } else {
      closeMention();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      handleSend();
    }
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
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {renderContent(comment.content)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="relative">
        {mentionQuery !== null && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 bg-popover border border-border rounded-md shadow-lg z-50 py-1 max-h-40 overflow-y-auto">
            {filteredUsers.map((u, i) => (
              <button
                key={u.id}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent ${i === mentionIndex ? 'bg-accent' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  insertMention(u);
                }}
              >
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                  {u.avatar}
                </span>
                <span className="truncate text-foreground">{u.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleInput}
            placeholder="Escreva um comentário... Use @ para mencionar"
            className="min-h-[36px] max-h-[80px] text-sm resize-none"
            onKeyDown={handleKeyDown}
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
    </div>
  );
}
