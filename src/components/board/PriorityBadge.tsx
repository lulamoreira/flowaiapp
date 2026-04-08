import { PRIORITY_CONFIG, TaskPriority } from '@/types';

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className="px-3 py-1 rounded text-xs font-semibold w-[90px] text-center inline-block"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}
