import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TaskGroup } from '@/types';

interface GroupHeaderProps {
  group: TaskGroup;
  taskCount: number;
  onToggle: () => void;
  onAddTask: () => void;
}

export function GroupHeader({ group, taskCount, onToggle, onAddTask }: GroupHeaderProps) {
  return (
    <div
      className="flex items-center gap-2 py-2 px-3 cursor-pointer select-none group"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {group.collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: group.color }} />
        <span className="font-semibold text-sm" style={{ color: group.color }}>
          {group.title}
        </span>
        <span className="text-xs text-muted-foreground ml-1">{taskCount} itens</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAddTask(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
