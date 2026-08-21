import { parseISO, isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data de tarefa (ISO string UTC do banco ou objeto Date) 
 * garantindo que seja exibida exatamente como os marcadores UTC gravados, 
 * ignorando o fuso horário local.
 */
export function formatTaskDate(date: string | Date | null | undefined, formatStr: string = 'dd MMM'): string {
  if (!date) return '—';
  
  try {
    let d: Date;
    
    if (typeof date === 'string') {
      d = parseISO(date);
    } else {
      d = date;
    }
    
    if (!isValid(d)) return '—';
    
    // Se for uma string ISO do banco, extraímos os componentes UTC.
    // Se for um objeto Date gerado localmente (como no calendário), 
    // queremos os componentes locais que representam o dia visual.
    // O pulo do gato: strings ISO costumam ter 'Z' ou '+00', Date objects não.
    
    const isISOString = typeof date === 'string' && (date.includes('Z') || date.includes('+'));
    
    const yyyy = isISOString ? d.getUTCFullYear() : d.getFullYear();
    const mm = isISOString ? d.getUTCMonth() : d.getMonth();
    const dd = isISOString ? d.getUTCDate() : d.getDate();
    const hh = isISOString ? d.getUTCHours() : d.getHours();
    const min = isISOString ? d.getUTCMinutes() : d.getMinutes();
    
    const markerDate = new Date(yyyy, mm, dd, hh, min);
    
    return format(markerDate, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data da tarefa:', error, date);
    return '—';
  }
}
