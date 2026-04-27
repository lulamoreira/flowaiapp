import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { TaskGroup } from '@/types';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface GroupHeaderProps {
  group: TaskGroup;
  taskCount: number;
  onToggle: () => void;
  onAddTask?: () => void;
  onRename?: (title: string) => void;
  onDelete?: () => void;
}

export function GroupHeader({ group, taskCount, onToggle, onAddTask, onRename, onDelete }: GroupHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(group.title);

  const handleSave = () => {
    if (title.trim() && onRename) {
      onRename(title.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-2 py-2 px-3 cursor-pointer select-none group/header"
      onClick={() => !editing && onToggle()}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {group.collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
        {editing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              className="h-6 text-sm w-40 px-1"
              autoFocus
            />
            <button onClick={handleSave} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm truncate" style={{ color: group.color }}>
              {group.title}
            </span>
            <span className="text-xs text-muted-foreground ml-1 shrink-0">{taskCount} itens</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
        {onAddTask && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddTask(); }}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        {onRename && (
          <button
            onClick={(e) => { e.stopPropagation(); setTitle(group.title); setEditing(true); }}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-destructive p-0.5"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
