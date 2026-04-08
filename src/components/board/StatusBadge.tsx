import { STATUS_CONFIG, TaskStatus } from '@/types';

export function StatusBadge({ status, onClick }: { status: TaskStatus; onClick?: () => void }) {
  const config = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded text-xs font-semibold text-white w-[110px] text-center transition-opacity hover:opacity-80"
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </button>
  );
}
