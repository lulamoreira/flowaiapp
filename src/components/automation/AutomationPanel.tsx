import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AutomationRule, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Zap, Plus, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface AutomationPanelProps {
  boardId: string;
}

export function AutomationPanel({ boardId }: AutomationPanelProps) {
  const { state, dispatch } = useAppStore();
  const { canEdit, canDelete } = usePermissions();
  const canEditAuto = canEdit('automations');
  const canDeleteAuto = canDelete('automations');
  const automations = state.automations.filter(a => a.boardId === boardId);
  const groups = state.groups.filter(g => g.boardId === boardId);

  const [triggerType, setTriggerType] = useState<string>('status_change');
  const [triggerValue, setTriggerValue] = useState('done');
  const [actionType, setActionType] = useState<string>('move_group');
  const [actionValue, setActionValue] = useState('');

  const triggerOptions = [
    { value: 'status_change', label: 'Status mudar para' },
    { value: 'date_passed', label: 'Data de entrega vencer' },
    { value: 'subtask_completed', label: 'Todas subtarefas concluídas' },
    { value: 'priority_change', label: 'Prioridade mudar para' },
  ];

  const actionOptions = [
    { value: 'move_group', label: 'Mover para grupo' },
    { value: 'change_priority', label: 'Mudar prioridade' },
    { value: 'change_status', label: 'Mudar status' },
    { value: 'assign_member', label: 'Atribuir ao membro' },
    { value: 'send_notification', label: 'Enviar notificação' },
  ];

  const buildLabel = () => {
    const trigger = triggerType === 'status_change'
      ? `status mudar para ${STATUS_CONFIG[triggerValue as keyof typeof STATUS_CONFIG]?.label || triggerValue}`
      : triggerType === 'date_passed'
      ? 'data de entrega vencer'
      : triggerType === 'subtask_completed'
      ? 'todas subtarefas forem concluídas'
      : `prioridade mudar para ${PRIORITY_CONFIG[triggerValue as keyof typeof PRIORITY_CONFIG]?.label || triggerValue}`;

    const action = actionType === 'move_group'
      ? `mover para ${groups.find(g => g.id === actionValue)?.title || 'grupo'}`
      : actionType === 'change_priority'
      ? `mudar prioridade para ${PRIORITY_CONFIG[actionValue as keyof typeof PRIORITY_CONFIG]?.label || actionValue}`
      : actionType === 'change_status'
      ? `mudar status para ${STATUS_CONFIG[actionValue as keyof typeof STATUS_CONFIG]?.label || actionValue}`
      : actionType === 'assign_member'
      ? `atribuir ao membro ${state.users.find(u => u.id === actionValue)?.name || ''}`
      : 'enviar notificação';

    return `Quando ${trigger}, ${action}`;
  };

  const addRule = () => {
    if (!actionValue && actionType !== 'send_notification') return;
    const rule: AutomationRule = {
      id: crypto.randomUUID(),
      boardId,
      triggerType: triggerType as any,
      triggerValue,
      actionType: actionType as any,
      actionValue,
      enabled: true,
      label: buildLabel(),
    };
    dispatch({ type: 'ADD_AUTOMATION', payload: rule });
  };

  const renderTriggerValueSelect = () => {
    if (triggerType === 'status_change' || triggerType === 'date_passed') {
      return (
        <Select value={triggerValue} onValueChange={setTriggerValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (triggerType === 'priority_change') {
      return (
        <Select value={triggerValue} onValueChange={setTriggerValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  const renderActionValueSelect = () => {
    if (actionType === 'move_group') {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (actionType === 'change_priority') {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (actionType === 'change_status') {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (actionType === 'assign_member') {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (actionType === 'send_notification') {
      return <p className="text-xs text-muted-foreground mt-1">Notificação enviada ao responsável da tarefa</p>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-[#fdab3d]" />
        <h3 className="text-sm font-semibold text-foreground">Automações</h3>
        <span className="text-xs text-muted-foreground">({automations.length} regras)</span>
      </div>

      {/* Existing rules */}
      <div className="space-y-2">
        {automations.map(rule => (
          <Card key={rule.id} className="border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Switch
                  checked={rule.enabled}
                  disabled={!canEditAuto}
                  onCheckedChange={() => canEditAuto && dispatch({ type: 'TOGGLE_AUTOMATION', payload: rule.id })}
                />
                <span className={`text-sm ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {rule.label}
                </span>
              </div>
              {canDeleteAuto && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => dispatch({ type: 'DELETE_AUTOMATION', payload: rule.id })}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {automations.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhuma automação configurada.</p>
        )}
      </div>

      {/* Add rule */}
      <Card className="border-dashed border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Nova regra</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quando</label>
              <Select value={triggerType} onValueChange={v => { setTriggerType(v); setTriggerValue('done'); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {triggerOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {triggerType !== 'subtask_completed' && triggerType !== 'date_passed' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
                {renderTriggerValueSelect()}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Então</label>
              <Select value={actionType} onValueChange={v => { setActionType(v); setActionValue(''); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {actionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
              {renderActionValueSelect()}
            </div>
          </div>
          <Button size="sm" onClick={addRule} className="bg-[#0073ea] hover:bg-[#0060c2] text-white h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar regra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
