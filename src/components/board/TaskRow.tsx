import { Task } from '@/types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { useAppStore } from '@/store/useAppStore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskRowProps {
  task: Task;
  groupColor: string;
  onClick: () => void;
}

export function TaskRow({ task, groupColor, onClick }: TaskRowProps) {
  const { state } = useAppStore();
  const assignee = state.users.find(u => u.id === task.assignee);

  return (
    <div
      className="flex items-center border-b border-border hover:bg-muted/30 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      <div className="w-1 self-stretch" style={{ backgroundColor: groupColor }} />
      <div className="flex-1 px-3 py-2.5 text-sm font-medium text-foreground min-w-[200px] truncate">
        {task.title}
      </div>
      <div className="w-[130px] px-2 flex justify-center">
        <StatusBadge status={task.status} />
      </div>
      <div className="w-[110px] px-2 flex justify-center">
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="w-[120px] px-2 flex items-center gap-1.5">
        {assignee && (
          <>
            <div className="w-6 h-6 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {assignee.avatar}
            </div>
            <span className="text-xs text-muted-foreground truncate">{assignee.name.split(' ')[0]}</span>
          </>
        )}
      </div>
      <div className="w-[100px] px-2 text-xs text-muted-foreground">
        {task.dueDate ? format(parseISO(task.dueDate), 'dd MMM', { locale: ptBR }) : '-'}
      </div>
    </div>
  );
}
