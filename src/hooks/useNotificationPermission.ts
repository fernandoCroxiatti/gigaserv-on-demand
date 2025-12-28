/**
 * useNotificationPermission - Hook centralizado para gerenciar permissão de notificações
 * 
 * Este hook é responsável por:
 * - Verificar o status atual da permissão (granted, denied, default)
 * - Controlar quando mostrar o modal de explicação
 * - Solicitar permissão APENAS após gesto explícito do usuário
 * - Registrar o usuário no OneSignal após permissão concedida
 * - Salvar o Player ID no banco de dados
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  initOneSignal,
  requestOneSignalPermission,
  isOneSignalPermissionGranted,
  getOneSignalPlayerId,
  oneSignalLogin,
  setOneSignalTags,
} from '@/lib/oneSignal';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface UseNotificationPermissionReturn {
  // Status atual da permissão
  permission: NotificationPermissionStatus;
  
  // Se devemos mostrar o CTA para ativar notificações
  shouldShowCTA: boolean;
  
  // Se o OneSignal está pronto
  isReady: boolean;
  
  // Player ID do OneSignal (se disponível)
  playerId: string | null;
  
  // Loading state
  loading: boolean;
  
  // Se o navegador suporta notificações
  isSupported: boolean;
  
  // Se já perguntamos ao usuário nesta sessão
  hasAskedThisSession: boolean;
  
  // Solicita permissão de notificação (deve ser chamado em gesto do usuário)
  requestPermission: () => Promise<boolean>;
  
  // Marca que o usuário recusou o modal de explicação (não o popup do sistema)
  dismissCTA: () => void;
  
  // Força verificação do status
  checkPermission: () => Promise<void>;
}

// Key para localStorage para controlar o CTA
const CTA_DISMISSED_KEY = 'notif_cta_dismissed';
const LAST_ASKED_KEY = 'notif_last_asked';

export function useNotificationPermission(activeProfile?: 'client' | 'provider'): UseNotificationPermissionReturn {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [isReady, setIsReady] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const hasAskedThisSessionRef = useRef(false);
  
  // Verificar suporte
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  
  // Inicialização e verificação de status
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        // Verificar se já foi dismissed
        const dismissed = localStorage.getItem(CTA_DISMISSED_KEY);
        if (dismissed) {
          const dismissedTime = parseInt(dismissed, 10);
          // Resetar após 24 horas para perguntar novamente
          if (Date.now() - dismissedTime > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(CTA_DISMISSED_KEY);
          } else {
            setCtaDismissed(true);
          }
        }
        
        if (!isSupported) {
          setPermission('unsupported');
          setLoading(false);
          return;
        }
        
        // Verificar permissão nativa primeiro
        const nativePermission = Notification.permission;
        if (nativePermission === 'granted') {
          setPermission('granted');
        } else if (nativePermission === 'denied') {
          setPermission('denied');
        } else {
          setPermission('default');
        }
        
        // Inicializar OneSignal
        await initOneSignal();
        
        if (!mounted) return;
        
        setIsReady(true);
        
        // Verificar permissão via OneSignal
        const granted = await isOneSignalPermissionGranted();
        if (mounted) {
          setPermission(granted ? 'granted' : nativePermission === 'denied' ? 'denied' : 'default');
        }
        
        // Obter Player ID se disponível
        const id = await getOneSignalPlayerId();
        if (mounted && id) {
          setPlayerId(id);
        }
        
      } catch (error) {
        console.error('[useNotificationPermission] Init error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [isSupported]);
  
  // Associar usuário ao OneSignal quando faz login
  useEffect(() => {
    if (!isReady || !user?.id) return;
    
    const associateUser = async () => {
      try {
        // Login no OneSignal
        await oneSignalLogin(user.id);
        
        // Definir tags para segmentação
        const tags: Record<string, string> = {
          user_id: user.id,
        };
        
        if (activeProfile) {
          tags.profile_type = activeProfile;
        }
        
        await setOneSignalTags(tags);
        
        // Obter e salvar Player ID
        const id = await getOneSignalPlayerId();
        if (id) {
          setPlayerId(id);
          
          // Salvar no banco de dados
          await supabase
            .from('notification_subscriptions')
            .upsert({
              user_id: user.id,
              endpoint: `onesignal://${id}`,
              p256dh: 'onesignal',
              auth: 'onesignal',
              user_agent: navigator.userAgent,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,endpoint',
            });
        }
      } catch (error) {
        console.error('[useNotificationPermission] Error associating user:', error);
      }
    };
    
    associateUser();
  }, [isReady, user?.id, activeProfile]);
  
  // Solicitar permissão - DEVE ser chamado em gesto explícito do usuário
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !isReady) {
      console.log('[useNotificationPermission] Cannot request - not ready or unsupported');
      return false;
    }
    
    if (permission === 'denied') {
      console.log('[useNotificationPermission] Permission already denied by browser');
      return false;
    }
    
    if (permission === 'granted') {
      console.log('[useNotificationPermission] Permission already granted');
      return true;
    }
    
    hasAskedThisSessionRef.current = true;
    localStorage.setItem(LAST_ASKED_KEY, Date.now().toString());
    
    console.log('[useNotificationPermission] Requesting permission via OneSignal...');
    
    try {
      const granted = await requestOneSignalPermission();
      
      setPermission(granted ? 'granted' : 'denied');
      
      if (granted) {
        // Remover dismiss do CTA já que aceitou
        localStorage.removeItem(CTA_DISMISSED_KEY);
        setCtaDismissed(false);
        
        // Obter e salvar Player ID
        const id = await getOneSignalPlayerId();
        if (id) {
          setPlayerId(id);
          
          // Salvar no banco de dados
          if (user?.id) {
            await supabase
              .from('notification_subscriptions')
              .upsert({
                user_id: user.id,
                endpoint: `onesignal://${id}`,
                p256dh: 'onesignal',
                auth: 'onesignal',
                user_agent: navigator.userAgent,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,endpoint',
              });
            
            // Atualizar preferências
            const { error: prefError } = await supabase
              .from('notification_preferences')
              .upsert({
                user_id: user.id,
                permission_asked_at: new Date().toISOString(),
                permission_granted: true,
                enabled: true,
                chamado_updates: true,
                promotional: true,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id',
              });
            
            if (prefError) {
              console.error('[useNotificationPermission] Error saving preferences:', prefError);
            }
          }
        }
      } else {
        // Salvar que foi negado
        if (user?.id) {
          const { error: prefError } = await supabase
            .from('notification_preferences')
            .upsert({
              user_id: user.id,
              permission_asked_at: new Date().toISOString(),
              permission_granted: false,
              enabled: false,
              chamado_updates: true,
              promotional: true,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id',
            });
          
          if (prefError) {
            console.error('[useNotificationPermission] Error saving preferences (denied):', prefError);
          }
        }
      }
      
      return granted;
    } catch (error) {
      console.error('[useNotificationPermission] Error requesting permission:', error);
      return false;
    }
  }, [isSupported, isReady, permission, user?.id]);
  
  // Dismissar CTA (não o popup do sistema)
  const dismissCTA = useCallback(() => {
    localStorage.setItem(CTA_DISMISSED_KEY, Date.now().toString());
    setCtaDismissed(true);
    hasAskedThisSessionRef.current = true;
  }, []);
  
  // Verificar permissão manualmente
  const checkPermission = useCallback(async () => {
    if (!isSupported) return;
    
    const nativePermission = Notification.permission;
    if (nativePermission === 'granted') {
      setPermission('granted');
    } else if (nativePermission === 'denied') {
      setPermission('denied');
    } else {
      setPermission('default');
    }
    
    if (isReady) {
      const granted = await isOneSignalPermissionGranted();
      setPermission(granted ? 'granted' : nativePermission === 'denied' ? 'denied' : 'default');
    }
  }, [isSupported, isReady]);
  
  // Determinar se devemos mostrar o CTA
  const shouldShowCTA = 
    isSupported && 
    permission === 'default' && 
    !ctaDismissed && 
    !loading;
  
  return {
    permission,
    shouldShowCTA,
    isReady,
    playerId,
    loading,
    isSupported,
    hasAskedThisSession: hasAskedThisSessionRef.current,
    requestPermission,
    dismissCTA,
    checkPermission,
  };
}
