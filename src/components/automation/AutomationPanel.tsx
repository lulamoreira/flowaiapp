import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AutomationRule, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Plus, Trash2 } from 'lucide-react';

interface AutomationPanelProps {
  boardId: string;
}

export function AutomationPanel({ boardId }: AutomationPanelProps) {
  const { state, dispatch } = useAppStore();
  const automations = state.automations.filter(a => a.boardId === boardId);
  const groups = state.groups.filter(g => g.boardId === boardId);

  const [triggerType, setTriggerType] = useState<'status_change' | 'date_passed'>('status_change');
  const [triggerValue, setTriggerValue] = useState('done');
  const [actionType, setActionType] = useState<'move_group' | 'change_priority' | 'change_status'>('move_group');
  const [actionValue, setActionValue] = useState('');

  const addRule = () => {
    if (!actionValue) return;
    const triggerLabel = triggerType === 'status_change'
      ? `status mudar para ${STATUS_CONFIG[triggerValue as keyof typeof STATUS_CONFIG]?.label}`
      : 'data de entrega vencer';
    const actionLabel = actionType === 'move_group'
      ? `mover para ${groups.find(g => g.id === actionValue)?.title}`
      : actionType === 'change_priority'
      ? `mudar prioridade para ${PRIORITY_CONFIG[actionValue as keyof typeof PRIORITY_CONFIG]?.label}`
      : `mudar status para ${STATUS_CONFIG[actionValue as keyof typeof STATUS_CONFIG]?.label}`;

    const rule: AutomationRule = {
      id: crypto.randomUUID(),
      boardId,
      triggerType,
      triggerValue,
      actionType,
      actionValue,
      enabled: true,
      label: `Quando ${triggerLabel}, ${actionLabel}`,
    };
    dispatch({ type: 'ADD_AUTOMATION', payload: rule });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-[#fdab3d]" />
        <h3 className="text-sm font-semibold text-foreground">Automações</h3>
      </div>

      {/* Existing rules */}
      <div className="space-y-2">
        {automations.map(rule => (
          <Card key={rule.id} className="border-border">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => dispatch({ type: 'TOGGLE_AUTOMATION', payload: rule.id })}
                />
                <span className={`text-sm ${rule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {rule.label}
                </span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => dispatch({ type: 'DELETE_AUTOMATION', payload: rule.id })}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add rule */}
      <Card className="border-dashed border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Nova regra</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quando</label>
              <Select value={triggerType} onValueChange={v => setTriggerType(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="status_change">Status mudar para</SelectItem>
                  <SelectItem value="date_passed">Data de entrega vencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {triggerType === 'status_change' && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
                <Select value={triggerValue} onValueChange={setTriggerValue}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Então</label>
              <Select value={actionType} onValueChange={v => setActionType(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="move_group">Mover para grupo</SelectItem>
                  <SelectItem value="change_priority">Mudar prioridade</SelectItem>
                  <SelectItem value="change_status">Mudar status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
              {actionType === 'move_group' ? (
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : actionType === 'change_priority' ? (
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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
