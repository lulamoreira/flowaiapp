import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data de tarefa (ISO string ou similar) garantindo que seja tratada em UTC.
 * Isso evita deslocamentos de fuso horário onde uma data gravada como 2026-08-15
 * aparece como 14 ago em alguns fusos.
 */
export function formatTaskDate(dateStr: string | null | undefined, formatStr: string = 'dd MMM'): string {
  if (!dateStr) return '—';
  
  try {
    // Se a string já tiver 'T', parseISO lidará corretamente.
    // Se for apenas 'YYYY-MM-DD', forçamos o tratamento como UTC adicionando 'T00:00:00Z'
    let normalizedDate = dateStr;
    if (dateStr.length === 10 && !dateStr.includes('T')) {
      normalizedDate = `${dateStr}T00:00:00Z`;
    } else if (dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      // Se tiver tempo mas não fuso, assumimos UTC
      normalizedDate = `${dateStr}Z`;
    }

    const date = parseISO(normalizedDate);
    
    // Para formatar em UTC sem deslocamento, usamos o fato de que getUTCDate etc.
    // Mas format() do date-fns usa o fuso local.
    // Uma forma simples de formatar "em UTC" é ajustar a data pelo offset local ANTES de formatar.
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const utcDate = new Date(date.getTime() + timezoneOffset);
    
    return format(utcDate, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data da tarefa:', error);
    return '—';
  }
}
