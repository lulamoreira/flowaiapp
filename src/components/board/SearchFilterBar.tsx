import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskStatus, TaskPriority, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
import { User } from '@/types';

interface SearchFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  priorityFilter: string;
  onPriorityChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (v: string) => void;
  users: User[];
}

export function SearchFilterBar({
  search, onSearchChange,
  statusFilter, onStatusChange,
  priorityFilter, onPriorityChange,
  assigneeFilter, onAssigneeChange,
  users,
}: SearchFilterBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefa..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-muted/50 border-0 text-sm"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-9 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <SelectItem key={key} value={key}>{val.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priorityFilter} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[140px] h-9 text-xs">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
            <SelectItem key={key} value={key}>{val.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
        <SelectTrigger className="w-[140px] h-9 text-xs">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {users.map(u => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
