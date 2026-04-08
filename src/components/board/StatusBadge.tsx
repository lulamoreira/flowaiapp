import { STATUS_CONFIG, TaskStatus } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

interface StatusBadgeProps {
  status: TaskStatus;
  onChange?: (status: TaskStatus) => void;
}

export function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[status];

  if (!onChange) {
    return (
      <span
        className="px-3 py-1 rounded text-xs font-semibold text-white w-[110px] text-center inline-block"
        style={{ backgroundColor: config.color }}
      >
        {config.label}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="px-3 py-1 rounded text-xs font-semibold text-white w-[110px] text-center transition-opacity hover:opacity-80"
          style={{ backgroundColor: config.color }}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        >
          {config.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-1" align="center" onClick={(e) => e.stopPropagation()}>
        {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(key => (
          <button
            key={key}
            className="w-full px-3 py-1.5 rounded text-xs font-semibold text-white text-center mb-0.5 transition-opacity hover:opacity-80"
            style={{ backgroundColor: STATUS_CONFIG[key].color }}
            onClick={(e) => { e.stopPropagation(); onChange(key); setOpen(false); }}
          >
            {STATUS_CONFIG[key].label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
