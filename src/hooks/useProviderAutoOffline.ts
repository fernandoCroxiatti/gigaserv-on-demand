import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { registerLogoutCleanup, isLoggingOutState } from './useAuth';

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
 * - Ignora operações durante logout para evitar conflitos
 */
export function useProviderAutoOffline({ userId, isOnline }: UseProviderAutoOfflineOptions): void {
  const isOnlineRef = useRef(isOnline);
  const userIdRef = useRef(userId);
  const isCleanedUpRef = useRef(false);

  useEffect(() => {
    isOnlineRef.current = isOnline;
    userIdRef.current = userId;
  }, [isOnline, userId]);

  const setPrestadorOffline = useCallback(() => {
    const currentUserId = userIdRef.current;
    const currentIsOnline = isOnlineRef.current;

    // Don't set offline during logout or if already cleaned up
    if (!currentUserId || !currentIsOnline || isLoggingOutState() || isCleanedUpRef.current) {
      return;
    }

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

  // Cleanup function for logout
  const cleanup = useCallback(() => {
    console.log('[ProviderAutoOffline] Cleanup triggered (logout)');
    isCleanedUpRef.current = true;
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handlePageHide, handleBeforeUnload]);

  // Register cleanup callback for logout
  useEffect(() => {
    const unregister = registerLogoutCleanup(cleanup);
    return unregister;
  }, [cleanup]);

  useEffect(() => {
    if (!userId) return;
    
    isCleanedUpRef.current = false;

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, handlePageHide, handleBeforeUnload]);
}
