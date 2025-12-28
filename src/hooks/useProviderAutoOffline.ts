import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProviderAutoOfflineOptions {
  userId: string | null;
  isOnline: boolean;
}

/**
 * Hook para forçar o prestador offline quando o app perde foco ou é fechado
 * 
 * COMPORTAMENTO:
 * - Adiciona listeners para visibilitychange, pagehide, beforeunload
 * - Quando o app sai do foco ou é fechado, executa setPrestadorOffline()
 * - NÃO altera como o status online é definido hoje
 * - Apenas força offline ao sair
 * - Falhas são silenciosas e não afetam o funcionamento
 */
export function useProviderAutoOffline({ userId, isOnline }: UseProviderAutoOfflineOptions): void {
  const isOnlineRef = useRef(isOnline);
  const userIdRef = useRef(userId);

  // Manter refs atualizadas
  useEffect(() => {
    isOnlineRef.current = isOnline;
    userIdRef.current = userId;
  }, [isOnline, userId]);

  // Função para forçar offline no banco
  const setPrestadorOffline = useCallback(async () => {
    const currentUserId = userIdRef.current;
    const currentIsOnline = isOnlineRef.current;

    // Só executar se estiver online e tiver userId
    if (!currentUserId || !currentIsOnline) {
      return;
    }

    console.log('[AutoOffline] App perdendo foco/fechando, forçando offline...');

    try {
      // Usar sendBeacon para garantir que a requisição seja enviada mesmo se a página fechar
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-provider-online`;
      
      const payload = JSON.stringify({ online: false });
      
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.warn('[AutoOffline] No session, cannot set offline');
        return;
      }

      // Tentar com sendBeacon primeiro (mais confiável ao fechar)
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        // sendBeacon não suporta headers customizados, então usar fetch como fallback
      }

      // Usar fetch com keepalive para garantir envio
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: payload,
        keepalive: true, // Importante: permite que a requisição continue após a página fechar
      }).catch((err) => {
        console.log('[AutoOffline] Fetch failed (expected on page close):', err.message);
      });

      console.log('[AutoOffline] Offline request sent');
    } catch (error) {
      // Nunca quebrar o fluxo
      console.log('[AutoOffline] Error setting offline (non-critical):', error);
    }
  }, []);

  // Handler para visibilitychange
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      setPrestadorOffline();
    }
  }, [setPrestadorOffline]);

  // Handler para pagehide
  const handlePageHide = useCallback(() => {
    setPrestadorOffline();
  }, [setPrestadorOffline]);

  // Handler para beforeunload
  const handleBeforeUnload = useCallback(() => {
    setPrestadorOffline();
  }, [setPrestadorOffline]);

  useEffect(() => {
    // Só adicionar listeners se tiver userId (usuário autenticado como prestador)
    if (!userId) {
      return;
    }

    // Adicionar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    console.log('[AutoOffline] Listeners registered for provider:', userId);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, handleVisibilityChange, handlePageHide, handleBeforeUnload]);
}
