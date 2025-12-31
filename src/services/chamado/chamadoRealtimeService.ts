/**
 * Chamado Realtime Service
 * Handles Supabase realtime subscriptions for chamados
 */

import { supabase } from '@/integrations/supabase/client';
import { Chamado } from '@/domain/chamado/types';
import { mapDbChamadoToDomain, DbChamadoRow } from '@/domain/chamado/mappers';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type ChamadoChangeCallback = (chamado: Chamado) => void;
export type ChamadoCancelCallback = () => void;

/**
 * Subscribe to chamado updates
 */
export function subscribeToChamado(
  chamadoId: string,
  onUpdate: ChamadoChangeCallback,
  onCancel: ChamadoCancelCallback
): RealtimeChannel {
  const channel = supabase
    .channel(`chamado-${chamadoId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chamados',
        filter: `id=eq.${chamadoId}`,
      },
      (payload: RealtimePostgresChangesPayload<DbChamadoRow>) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = mapDbChamadoToDomain(payload.new as DbChamadoRow);
          
          if (updated.status === 'canceled') {
            onCancel();
          } else {
            onUpdate(updated);
          }
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from chamado updates
 */
export function unsubscribeFromChamado(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

/**
 * Subscribe to new chamados for providers (searching status)
 */
export function subscribeToNewChamados(
  onNewChamado: ChamadoChangeCallback
): RealtimeChannel {
  const channel = supabase
    .channel('new-chamados')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chamados',
        filter: 'status=eq.searching',
      },
      (payload: RealtimePostgresChangesPayload<DbChamadoRow>) => {
        if (payload.new) {
          const chamado = mapDbChamadoToDomain(payload.new as DbChamadoRow);
          onNewChamado(chamado);
        }
      }
    )
    .subscribe();

  return channel;
}
