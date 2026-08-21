import { parseISO, isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data de tarefa (ISO string UTC do banco) garantindo que seja exibida
 * exatamente como os marcadores UTC gravados, ignorando o fuso horário local.
 * 
 * Se o banco tem "2026-08-15T00:00:00Z", queremos mostrar "15 ago"
 * independentemente do navegador estar em UTC-3 ou UTC+2.
 */
export function formatTaskDate(dateStr: string | null | undefined, formatStr: string = 'dd MMM'): string {
  if (!dateStr) return '—';
  
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '—';
    
    // Extraímos os componentes UTC
    const yyyy = date.getUTCFullYear();
    const mm = date.getUTCMonth();
    const dd = date.getUTCDate();
    const hh = date.getUTCHours();
    const min = date.getUTCMinutes();
    
    // Criamos um objeto Date "local" que aponta para os mesmos números
    // Assim o format() do date-fns usará esses números sem deslocamento.
    const markerDate = new Date(yyyy, mm, dd, hh, min);
    
    return format(markerDate, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data da tarefa:', error, dateStr);
    return '—';
  }
}
