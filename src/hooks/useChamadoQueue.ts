import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Chamado, ChamadoStatus, ServiceType, PaymentMethod } from '@/types/chamado';
import { Database } from '@/integrations/supabase/types';

type DbChamado = Database['public']['Tables']['chamados']['Row'];

// Poll interval for queue check (5 seconds)
const QUEUE_POLL_INTERVAL_MS = 5_000;

// Cooldown after declining a chamado (10 seconds)
const DECLINE_COOLDOWN_MS = 10_000;

interface UseChamadoQueueProps {
  userId: string | null;
  isOnline: boolean;
  isProvider: boolean;
  hasActiveChamado: boolean;
  currentIncomingRequest: Chamado | null;
  onNewChamado: (chamado: Chamado) => void;
}

function mapDbChamadoToChamado(db: DbChamado): Chamado {
  return {
    id: db.id,
    status: db.status as ChamadoStatus,
    tipoServico: db.tipo_servico as ServiceType,
    clienteId: db.cliente_id || '',
    prestadorId: db.prestador_id,
    origem: {
      lat: Number(db.origem_lat),
      lng: Number(db.origem_lng),
      address: db.origem_address,
    },
    destino: db.destino_lat && db.destino_lng ? {
      lat: Number(db.destino_lat),
      lng: Number(db.destino_lng),
      address: db.destino_address || '',
    } : null,
    valor: db.valor ? Number(db.valor) : null,
    valorProposto: db.valor_proposto ? Number(db.valor_proposto) : null,
    vehicleType: (db as any).vehicle_type || null,
    payment: db.payment_status ? {
      id: db.stripe_payment_intent_id || `payment-${db.id}`,
      status: db.payment_status,
      method: (db.payment_method as PaymentMethod) || 'pix',
      amount: db.valor ? Number(db.valor) : 0,
      currency: 'BRL',
      provider: (db.payment_provider as 'mock' | 'stripe' | 'mercadopago') || 'mock',
      stripePaymentIntentId: db.stripe_payment_intent_id || undefined,
      createdAt: new Date(db.created_at),
    } : null,
    directPaymentToProvider: db.direct_payment_to_provider === true,
    directPaymentReceiptConfirmed: db.direct_payment_receipt_confirmed === true,
    directPaymentConfirmedAt: db.direct_payment_confirmed_at ? new Date(db.direct_payment_confirmed_at) : null,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

export function useChamadoQueue({
  userId,
  isOnline,
  isProvider,
  hasActiveChamado,
  currentIncomingRequest,
  onNewChamado,
}: UseChamadoQueueProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const declinedChamadosRef = useRef<Map<string, number>>(new Map());

  // Mark a chamado as declined (local cooldown)
  const markAsDeclined = useCallback((chamadoId: string) => {
    declinedChamadosRef.current.set(chamadoId, Date.now());
    console.log(`[ChamadoQueue] Marked chamado ${chamadoId.substring(0, 8)} as declined`);
  }, []);

  // Check if a chamado is in cooldown
  const isInCooldown = useCallback((chamadoId: string): boolean => {
    const declinedAt = declinedChamadosRef.current.get(chamadoId);
    if (!declinedAt) return false;
    
    const elapsed = Date.now() - declinedAt;
    if (elapsed >= DECLINE_COOLDOWN_MS) {
      declinedChamadosRef.current.delete(chamadoId);
      return false;
    }
    return true;
  }, []);

  // Poll the queue for pending chamados
  const pollQueue = useCallback(async () => {
    if (!userId || !isOnline || !isProvider || hasActiveChamado) {
      return;
    }

    // Don't poll if already showing a request
    if (currentIncomingRequest) {
      return;
    }

    try {
      console.log(`[ChamadoQueue] Polling queue...`);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        console.log(`[ChamadoQueue] No session, skipping poll`);
        return;
      }

      const response = await supabase.functions.invoke('pending-chamados', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) {
        console.error(`[ChamadoQueue] Error polling queue:`, response.error);
        return;
      }

      const { firstChamado, queueSize: size } = response.data || {};
      setQueueSize(size || 0);
      setLastPollTime(new Date());

      if (firstChamado && !isInCooldown(firstChamado.id)) {
        console.log(`[ChamadoQueue] Found pending chamado:`, firstChamado.id.substring(0, 8));
        const chamado = mapDbChamadoToChamado(firstChamado);
        onNewChamado(chamado);
      } else if (size > 0) {
        console.log(`[ChamadoQueue] ${size} chamados in queue but all in cooldown or already showing`);
      }
    } catch (error) {
      console.error(`[ChamadoQueue] Poll error:`, error);
    }
  }, [userId, isOnline, isProvider, hasActiveChamado, currentIncomingRequest, isInCooldown, onNewChamado]);

  // Force poll (for visibility change, reconnection, etc.)
  const forcePoll = useCallback(() => {
    console.log(`[ChamadoQueue] Force poll triggered`);
    pollQueue();
  }, [pollQueue]);

  // Start/stop polling based on conditions
  useEffect(() => {
    const shouldPoll = userId && isOnline && isProvider && !hasActiveChamado;

    if (shouldPoll) {
      console.log(`[ChamadoQueue] Starting queue polling (every ${QUEUE_POLL_INTERVAL_MS / 1000}s)`);
      setIsPolling(true);
      
      // Initial poll
      pollQueue();
      
      // Set up interval
      pollIntervalRef.current = setInterval(pollQueue, QUEUE_POLL_INTERVAL_MS);
    } else {
      console.log(`[ChamadoQueue] Stopping queue polling`);
      setIsPolling(false);
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [userId, isOnline, isProvider, hasActiveChamado, pollQueue]);

  // Handle visibility change - force poll when app comes to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPolling) {
        console.log(`[ChamadoQueue] App became visible, forcing poll`);
        forcePoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPolling, forcePoll]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (isPolling) {
        console.log(`[ChamadoQueue] Network came online, forcing poll`);
        forcePoll();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isPolling, forcePoll]);

  return {
    isPolling,
    lastPollTime,
    queueSize,
    markAsDeclined,
    forcePoll,
  };
}
