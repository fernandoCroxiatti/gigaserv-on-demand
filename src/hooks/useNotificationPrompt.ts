/**
 * useNotificationPrompt - Hook para exibir prompt de notificação automaticamente
 * 
 * Verifica se o usuário:
 * 1. Está logado
 * 2. Ainda não aceitou as notificações
 * 3. Não recusou recentemente (nas últimas 24h)
 * 
 * Se todas as condições forem verdadeiras, exibe o modal de permissão
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { isOneSignalPermissionGranted } from '@/lib/oneSignal';

// Key para localStorage
const PROMPT_DISMISSED_KEY = 'notif_prompt_dismissed_at';
const PROMPT_DELAY_MS = 2000; // 2 segundos após o app carregar

interface UseNotificationPromptReturn {
  // Se devemos mostrar o modal
  showPrompt: boolean;
  
  // Usuário aceitou
  onAccept: () => void;
  
  // Usuário recusou
  onDecline: () => void;
  
  // Status do usuário
  hasAcceptedNotifications: boolean;
  
  // Loading
  loading: boolean;
}

export function useNotificationPrompt(): UseNotificationPromptReturn {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [hasAcceptedNotifications, setHasAcceptedNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasCheckedRef = useRef(false);
  
  // Verificar estado das notificações do usuário
  useEffect(() => {
    if (!user?.id || hasCheckedRef.current) {
      setLoading(false);
      return;
    }
    
    let mounted = true;
    
    const checkNotificationStatus = async () => {
      try {
        console.log('[NotificationPrompt] Checking notification status for user:', user.id);
        
        // 1. Verificar se já tem permissão no navegador
        const browserPermission = typeof Notification !== 'undefined' 
          ? Notification.permission 
          : 'denied';
        
        console.log('[NotificationPrompt] Browser permission:', browserPermission);
        
        // 2. Verificar se já está registrado no OneSignal
        const oneSignalGranted = await isOneSignalPermissionGranted();
        console.log('[NotificationPrompt] OneSignal granted:', oneSignalGranted);
        
        // 3. Verificar no banco de dados
        const { data: prefs, error: prefsError } = await supabase
          .from('notification_preferences')
          .select('permission_granted, enabled, permission_asked_at')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (prefsError) {
          console.error('[NotificationPrompt] Error fetching preferences:', prefsError);
        }
        
        console.log('[NotificationPrompt] DB preferences:', prefs);
        
        // 4. Verificar se tem subscription salva
        const { data: subs, error: subsError } = await supabase
          .from('notification_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        
        if (subsError) {
          console.error('[NotificationPrompt] Error fetching subscriptions:', subsError);
        }
        
        const hasSubscription = subs && subs.length > 0;
        console.log('[NotificationPrompt] Has subscription:', hasSubscription);
        
        if (!mounted) return;
        
        // Se já aceitou e tem subscription, não mostrar
        if ((browserPermission === 'granted' && oneSignalGranted) || hasSubscription) {
          console.log('[NotificationPrompt] User already has notifications enabled');
          setHasAcceptedNotifications(true);
          setShowPrompt(false);
          hasCheckedRef.current = true;
          setLoading(false);
          return;
        }
        
        // Se o navegador negou permanentemente
        if (browserPermission === 'denied') {
          console.log('[NotificationPrompt] Browser permanently denied');
          setHasAcceptedNotifications(false);
          setShowPrompt(false);
          hasCheckedRef.current = true;
          setLoading(false);
          return;
        }
        
        // Verificar se foi dismissado recentemente (nas últimas 24h)
        const dismissedAt = localStorage.getItem(PROMPT_DISMISSED_KEY);
        if (dismissedAt) {
          const dismissedTime = parseInt(dismissedAt, 10);
          const hoursSinceDismiss = (Date.now() - dismissedTime) / (1000 * 60 * 60);
          
          if (hoursSinceDismiss < 24) {
            console.log('[NotificationPrompt] Dismissed recently, skipping');
            setHasAcceptedNotifications(false);
            setShowPrompt(false);
            hasCheckedRef.current = true;
            setLoading(false);
            return;
          }
          
          // Limpar se passou 24h
          localStorage.removeItem(PROMPT_DISMISSED_KEY);
        }
        
        // Se chegou aqui, devemos mostrar o prompt após um delay
        console.log('[NotificationPrompt] Will show prompt in', PROMPT_DELAY_MS, 'ms');
        setHasAcceptedNotifications(false);
        hasCheckedRef.current = true;
        setLoading(false);
        
        // Delay para não interromper o carregamento inicial
        setTimeout(() => {
          if (mounted) {
            console.log('[NotificationPrompt] Showing notification prompt');
            setShowPrompt(true);
          }
        }, PROMPT_DELAY_MS);
        
      } catch (error) {
        console.error('[NotificationPrompt] Error:', error);
        if (mounted) {
          setLoading(false);
          hasCheckedRef.current = true;
        }
      }
    };
    
    checkNotificationStatus();
    
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  
  // Handler quando usuário aceita
  const onAccept = useCallback(() => {
    console.log('[NotificationPrompt] User accepted');
    setShowPrompt(false);
    setHasAcceptedNotifications(true);
    localStorage.removeItem(PROMPT_DISMISSED_KEY);
  }, []);
  
  // Handler quando usuário recusa
  const onDecline = useCallback(() => {
    console.log('[NotificationPrompt] User declined');
    setShowPrompt(false);
    localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
  }, []);
  
  return {
    showPrompt,
    onAccept,
    onDecline,
    hasAcceptedNotifications,
    loading,
  };
}
