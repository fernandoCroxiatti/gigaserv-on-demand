/**
 * NotificationPromptWrapper - Componente que exibe o modal de permissão automaticamente
 * 
 * Deve ser usado na página principal após o login
 */

import React, { useCallback } from 'react';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { useNotificationPrompt } from '@/hooks/useNotificationPrompt';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useApp } from '@/contexts/AppContext';

export function NotificationPromptWrapper() {
  const { user } = useApp();
  const activeProfile = user?.activeProfile || 'client';
  
  const { showPrompt, onAccept, onDecline } = useNotificationPrompt();
  const { requestPermission } = useNotificationPermission(activeProfile);
  
  // Handler quando usuário confirma
  const handleConfirm = useCallback(async () => {
    console.log('[NotificationPromptWrapper] User clicked confirm');
    
    try {
      const granted = await requestPermission();
      console.log('[NotificationPromptWrapper] Permission result:', granted);
      
      if (granted) {
        onAccept();
      } else {
        // Se negou no popup do sistema, ainda assim fechamos o modal
        onDecline();
      }
    } catch (error) {
      console.error('[NotificationPromptWrapper] Error requesting permission:', error);
      onDecline();
    }
  }, [requestPermission, onAccept, onDecline]);
  
  // Handler quando usuário recusa
  const handleDecline = useCallback(() => {
    console.log('[NotificationPromptWrapper] User clicked decline');
    onDecline();
  }, [onDecline]);
  
  return (
    <NotificationPermissionModal
      open={showPrompt}
      onConfirm={handleConfirm}
      onDecline={handleDecline}
      userType={activeProfile}
    />
  );
}
