import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Chamado, ChamadoStatus, ServiceType, PaymentMethod } from '@/types/chamado';
import { Database } from '@/integrations/supabase/types';
import { registerLogoutCleanup, isLoggingOutState } from './useAuth';

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
    
    // Negotiation tracking
    lastProposalBy: (db as any).last_proposal_by as 'client' | 'provider' | null,
    valueAccepted: (db as any).value_accepted === true,
    
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

/**
 * QUEUE-BASED CHAMADO SYSTEM
 * 
 * Uses the backend queue as the SINGLE SOURCE OF TRUTH.
 * NO realtime subscriptions for discovering chamados.
 * Polling every 5 seconds for consistent cross-platform behavior.
 * Complete state reset on mount and visibility change.
 */
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
  const isMountedRef = useRef(true);
  const pollInProgressRef = useRef(false);

  // RESET - Clear all local state
  const resetState = useCallback(() => {
    console.log('[ChamadoQueue] RESET - Clearing all state');
    setQueueSize(0);
    setLastPollTime(null);
    pollInProgressRef.current = false;
    // Keep declined chamados to prevent immediate re-offer
  }, []);

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

  // Clean up old cooldowns
  const cleanupCooldowns = useCallback(() => {
    const now = Date.now();
    const toDelete: string[] = [];
    
    declinedChamadosRef.current.forEach((timestamp, id) => {
      if (now - timestamp >= DECLINE_COOLDOWN_MS) {
        toDelete.push(id);
      }
    });
    
    toDelete.forEach(id => declinedChamadosRef.current.delete(id));
  }, []);

  // Poll the queue for pending chamados
  const pollQueue = useCallback(async () => {
    // Check for logout state first
    if (isLoggingOutState()) {
      console.log('[ChamadoQueue] Skipping poll - logging out');
      return;
    }

    if (!userId || !isOnline || !isProvider || hasActiveChamado) {
      return;
    }

    // Don't poll if already showing a request
    if (currentIncomingRequest) {
      return;
    }

    // Prevent concurrent polls
    if (pollInProgressRef.current) {
      console.log('[ChamadoQueue] Poll already in progress, skipping');
      return;
    }

    pollInProgressRef.current = true;
    const pollId = Date.now();

    try {
      console.log(`[ChamadoQueue] Poll #${pollId} - Starting...`);
      
      // Clean up old cooldowns
      cleanupCooldowns();
      
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session?.access_token) {
        console.log(`[ChamadoQueue] Poll #${pollId} - No valid session, skipping`);
        return;
      }

      if (!isMountedRef.current) {
        console.log(`[ChamadoQueue] Poll #${pollId} - Component unmounted, discarding`);
        return;
      }

      const response = await supabase.functions.invoke('pending-chamados', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!isMountedRef.current) {
        console.log(`[ChamadoQueue] Poll #${pollId} - Component unmounted after fetch, discarding`);
        return;
      }

      if (response.error) {
        console.error(`[ChamadoQueue] Poll #${pollId} - Error:`, response.error);
        // On error, reset queue size to avoid stale data
        setQueueSize(0);
        return;
      }

      const { firstChamado, queueSize: size } = response.data || {};
      
      console.log(`[ChamadoQueue] Poll #${pollId} - Queue size: ${size || 0}`);
      setQueueSize(size || 0);
      setLastPollTime(new Date());

      if (firstChamado && !isInCooldown(firstChamado.id)) {
        console.log(`[ChamadoQueue] Poll #${pollId} - Found pending chamado: ${firstChamado.id.substring(0, 8)}`);
        const chamado = mapDbChamadoToChamado(firstChamado);
        onNewChamado(chamado);
      } else if (size > 0) {
        console.log(`[ChamadoQueue] Poll #${pollId} - ${size} chamados in queue but all in cooldown`);
      }
    } catch (error) {
      console.error(`[ChamadoQueue] Poll #${pollId} - Exception:`, error);
      setQueueSize(0);
    } finally {
      pollInProgressRef.current = false;
    }
  }, [userId, isOnline, isProvider, hasActiveChamado, currentIncomingRequest, isInCooldown, onNewChamado, cleanupCooldowns]);

  // Force poll (for visibility change, reconnection, etc.)
  const forcePoll = useCallback(() => {
    console.log('[ChamadoQueue] Force poll triggered');
    pollQueue();
  }, [pollQueue]);

  // Handle visibility change - FORCE RESET + REFETCH
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[ChamadoQueue] App became visible - RESETTING and refetching');
        resetState();
        // Small delay to ensure state is cleared
        setTimeout(() => {
          if (isMountedRef.current && isPolling) {
            pollQueue();
          }
        }, 100);
      } else {
        console.log('[ChamadoQueue] App going to background - clearing queue size');
        setQueueSize(0);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetState, pollQueue, isPolling]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ChamadoQueue] Network came online - resetting and refetching');
      resetState();
      setTimeout(() => {
        if (isMountedRef.current && isPolling) {
          pollQueue();
        }
      }, 100);
    };

    const handleOffline = () => {
      console.log('[ChamadoQueue] Network offline - clearing state');
      setQueueSize(0);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [resetState, pollQueue, isPolling]);

  // Cleanup function for logout
  const stopPolling = useCallback(() => {
    console.log('[ChamadoQueue] Stopping polling (logout cleanup)');
    isMountedRef.current = false;
    setIsPolling(false);
    setQueueSize(0);
    setLastPollTime(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Register cleanup callback for logout
  useEffect(() => {
    const unregister = registerLogoutCleanup(stopPolling);
    return unregister;
  }, [stopPolling]);

  // Start/stop polling based on conditions
  useEffect(() => {
    isMountedRef.current = true;
    
    // Don't start if logging out
    if (isLoggingOutState()) {
      console.log('[ChamadoQueue] Not starting - app is logging out');
      return;
    }
    
    const shouldPoll = userId && isOnline && isProvider && !hasActiveChamado;

    if (shouldPoll) {
      console.log(`[ChamadoQueue] Starting queue polling (every ${QUEUE_POLL_INTERVAL_MS / 1000}s)`);
      setIsPolling(true);
      
      // RESET on start
      resetState();
      
      // Initial poll after reset
      const initialPollTimeout = setTimeout(() => {
        if (isMountedRef.current && !isLoggingOutState()) {
          pollQueue();
        }
      }, 100);
      
      // Set up interval
      pollIntervalRef.current = setInterval(() => {
        if (isMountedRef.current && !isLoggingOutState()) {
          pollQueue();
        }
      }, QUEUE_POLL_INTERVAL_MS);

      return () => {
        clearTimeout(initialPollTimeout);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    } else {
      console.log('[ChamadoQueue] Stopping queue polling');
      setIsPolling(false);
      setQueueSize(0);
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [userId, isOnline, isProvider, hasActiveChamado, pollQueue, resetState]);

  return {
    isPolling,
    lastPollTime,
    queueSize,
    markAsDeclined,
    forcePoll,
    reset: resetState,
  };
}
