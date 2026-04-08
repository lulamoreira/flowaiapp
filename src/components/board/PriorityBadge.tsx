import { PRIORITY_CONFIG, TaskPriority } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

interface PriorityBadgeProps {
  priority: TaskPriority;
  onChange?: (priority: TaskPriority) => void;
}

export function PriorityBadge({ priority, onChange }: PriorityBadgeProps) {
  const [open, setOpen] = useState(false);
  const config = PRIORITY_CONFIG[priority];

  if (!onChange) {
    return (
      <span
        className="px-3 py-1 rounded text-xs font-semibold w-[90px] text-center inline-block"
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="px-3 py-1 rounded text-xs font-semibold w-[90px] text-center transition-opacity hover:opacity-80"
          style={{ backgroundColor: config.bg, color: config.color }}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {config.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-1" align="center" onClick={(e) => e.stopPropagation()}>
        {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(key => (
          <button
            key={key}
            className="w-full px-3 py-1.5 rounded text-xs font-semibold text-center mb-0.5 transition-opacity hover:opacity-80"
            style={{ backgroundColor: PRIORITY_CONFIG[key].bg, color: PRIORITY_CONFIG[key].color }}
            onClick={(e) => { e.stopPropagation(); onChange(key); setOpen(false); }}
          >
            {PRIORITY_CONFIG[key].label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
