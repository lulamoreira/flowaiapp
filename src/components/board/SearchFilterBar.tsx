import { Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
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
  dueDateFilter: string;
  onDueDateChange: (v: string) => void;
  users: User[];
  boardId?: string;
}

export function SearchFilterBar({
  search, onSearchChange,
  statusFilter, onStatusChange,
  priorityFilter, onPriorityChange,
  assigneeFilter, onAssigneeChange,
  dueDateFilter, onDueDateChange,
  users,
  boardId,
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
          {(() => {
            const { state } = useAppStore();
            const authorizedIds = boardId ? (state.projectMembers[boardId] || []) : [];
            const hasAuthorized = boardId && authorizedIds.length > 0;
            
            const filteredUsers = users.filter(u => {
              if (u.id === assigneeFilter) return true;
              if (!hasAuthorized) return true;
              return authorizedIds.includes(u.id);
            });

            return filteredUsers.map(u => {
              const isNotAuthorized = hasAuthorized && !authorizedIds.includes(u.id) && u.id === assigneeFilter;
              return (
                <SelectItem key={u.id} value={u.id}>
                  <div className="flex flex-col">
                    <span>{u.name}</span>
                    {isNotAuthorized && (
                      <span className="text-[9px] text-destructive leading-tight">sem autorização</span>
                    )}
                  </div>
                </SelectItem>
              );
            });
          })()}
        </SelectContent>
      </Select>
      <Select value={dueDateFilter} onValueChange={onDueDateChange}>
        <SelectTrigger className="w-[150px] h-9 text-xs">
          <SelectValue placeholder="Data de entrega" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as datas</SelectItem>
          <SelectItem value="overdue">Atrasadas</SelectItem>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="this_week">Esta semana</SelectItem>
          <SelectItem value="next_week">Próxima semana</SelectItem>
          <SelectItem value="no_date">Sem data</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
