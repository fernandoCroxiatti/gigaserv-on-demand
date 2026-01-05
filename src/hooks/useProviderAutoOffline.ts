import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProviderAutoOfflineOptions {
  userId: string | null;
  isOnline: boolean;
}

/**
 * Hook para forçar o prestador offline quando o app é fechado.
 *
 * MOTIVO (bugfix): o evento `visibilitychange` dispara ao trocar de aba.
 * Em cenários de teste (cliente e prestador no mesmo navegador), isso derrubava o prestador
 * para OFFLINE e ele deixava de receber chamados.
 *
 * COMPORTAMENTO:
 * - Listeners: pagehide, beforeunload
 * - Falhas são silenciosas e não afetam o funcionamento
 */
export function useProviderAutoOffline({ userId, isOnline }: UseProviderAutoOfflineOptions): void {
  const isOnlineRef = useRef(isOnline);
  const userIdRef = useRef(userId);

  useEffect(() => {
    isOnlineRef.current = isOnline;
    userIdRef.current = userId;
  }, [isOnline, userId]);

  const setPrestadorOffline = useCallback(() => {
    const currentUserId = userIdRef.current;
    const currentIsOnline = isOnlineRef.current;

    if (!currentUserId || !currentIsOnline) return;

    try {
      // Não aguardar (eventos de fechamento não gostam de async) e nunca quebrar fluxo
      void supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        void supabase.functions.invoke('toggle-provider-online', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: { online: false },
        });
      });
    } catch {
      // Silencioso por design
    }
  }, []);

  const handlePageHide = useCallback(() => {
    setPrestadorOffline();
  }, [setPrestadorOffline]);

  const handleBeforeUnload = useCallback(() => {
    setPrestadorOffline();
  }, [setPrestadorOffline]);

  useEffect(() => {
    if (!userId) return;

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, handlePageHide, handleBeforeUnload]);
}
