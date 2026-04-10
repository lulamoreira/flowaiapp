import { useState } from 'react';
import { useTimeTracking, formatDuration } from '@/hooks/useTimeTracking';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Play, Square, Plus, Trash2, Clock, Timer } from 'lucide-react';
import { toast } from 'sonner';

interface TaskTimeTrackingProps {
  taskId: string;
}

export function TaskTimeTracking({ taskId }: TaskTimeTrackingProps) {
  const { user } = useAuth();
  const {
    entries,
    loading,
    activeTimer,
    elapsed,
    totalSeconds,
    startTimer,
    stopTimer,
    addManualEntry,
    deleteEntry,
  } = useTimeTracking(taskId);

  const [manualHours, setManualHours] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [showManual, setShowManual] = useState(false);

  const isTimerRunning = activeTimer?.taskId === taskId;

  const handleToggleTimer = async () => {
    if (isTimerRunning) {
      await stopTimer();
      toast.success('Timer parado e tempo registrado');
    } else {
      startTimer(taskId);
    }
  };

  const handleManualSubmit = async () => {
    const hours = parseFloat(manualHours);
    if (isNaN(hours) || hours <= 0) {
      toast.error('Informe um valor válido de horas');
      return;
    }
    await addManualEntry(taskId, hours * 60, manualDesc.trim());
    setManualHours('');
    setManualDesc('');
    setShowManual(false);
    toast.success('Horas registradas com sucesso');
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Horas ({formatDuration(totalSeconds)} total)
      </label>

      {/* Timer controls */}
      <div className="flex items-center gap-3 mb-3">
        <Button
          size="sm"
          variant={isTimerRunning ? 'destructive' : 'default'}
          className="h-8 gap-1.5"
          onClick={handleToggleTimer}
        >
          {isTimerRunning ? (
            <>
              <Square className="h-3.5 w-3.5" />
              Parar
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Iniciar Timer
            </>
          )}
        </Button>
        {isTimerRunning && (
          <span className="text-sm font-mono font-semibold text-primary animate-pulse">
            {formatDuration(elapsed)}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 ml-auto"
          onClick={() => setShowManual(!showManual)}
        >
          <Plus className="h-3.5 w-3.5" />
          Manual
        </Button>
      </div>

      {/* Manual entry form */}
      {showManual && (
        <div className="border border-border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
          <div className="flex gap-2">
            <div className="w-24">
              <label className="text-[10px] text-muted-foreground">Horas</label>
              <Input
                type="number"
                step="0.25"
                min="0.01"
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                placeholder="1.5"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">Descrição</label>
              <Input
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                placeholder="O que foi feito..."
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowManual(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleManualSubmit}>
              Registrar
            </Button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum registro de horas ainda.</p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2.5 py-1.5 group">
              <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{formatDuration(entry.duration_seconds)}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground truncate flex-1">
                {entry.description || (entry.entry_type === 'timer' ? 'Timer' : 'Manual')}
              </span>
              <span className="text-muted-foreground shrink-0">{entry.user_name}</span>
              {entry.user_id === user?.id && (
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
