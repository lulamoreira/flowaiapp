import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on one or more Postgres tables and calls
 * `onChange` (debounced) whenever any of them mutates.
 *
 * Designed to be safe for forms: it only triggers a callback (typically a
 * data refetch). It does NOT touch local component state like input values,
 * so users keep typing without losing focus or characters.
 */
export function useRealtimeRefresh(
  tables: string[],
  onChange: () => void,
  options: { debounceMs?: number; channelName?: string } = {}
) {
  const { debounceMs = 400, channelName } = options;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!tables || tables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const name = channelName || `rt-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(name);

    tables.forEach((table) => {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        trigger
      );
    });

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join('|'), debounceMs, channelName]);
}
